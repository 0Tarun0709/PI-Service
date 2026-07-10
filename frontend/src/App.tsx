import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { ArtifactPanel, type LogEntry } from './components/ArtifactPanel';
import { Send, Settings, Terminal } from 'lucide-react';

const API_URL = 'http://localhost:3000/api';

interface Session {
  id: string;
  workspace_path: string;
  model: string;
  status: string;
  created_at: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isStateful, setIsStateful] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statusText, setStatusText] = useState('Idle');
  
  // Modals & Panels toggle
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isArtifactOpen, setIsArtifactOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // Settings state
  const [settings, setSettings] = useState({
    modelProvider: 'openrouter',
    modelId: 'poolside/laguna-xs-2.1:free',
    systemPrompt: 'You are a helpful and concise AI coding assistant.',
    tools: ['read', 'write', 'edit', 'ls', 'grep', 'bash'],
    workspacePath: '',
    isStateful: false
  });

  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Toggle Dark Mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Load Session List on Load
  useEffect(() => {
    loadSessions();
  }, []);

  // Scroll to bottom of message list on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSessions = async () => {
    try {
      const response = await fetch(`${API_URL}/sessions`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Failed to load session list:', err);
    }
  };

  const handleSelectSession = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/sessions/${id}`);
      if (!response.ok) throw new Error('Session details not found');
      const details = await response.json();

      setActiveSessionId(id);
      setIsStateful(true);
      setMessages(
        details.messages.map((m: any) => ({
          role: m.role,
          content: m.content[0]?.text || m.content
        }))
      );
      setLogs([]);
      setIsArtifactOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to load session history');
    }
  };

  const handleSelectStateless = () => {
    setActiveSessionId(null);
    setIsStateful(false);
    setMessages([]);
    setLogs([]);
    setIsArtifactOpen(false);
  };

  const handleCreateSession = async () => {
    try {
      setStatusText('Initializing Agent...');
      const response = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelProvider: settings.modelProvider,
          modelId: settings.modelId,
          workspacePath: settings.workspacePath || undefined,
          systemPrompt: settings.systemPrompt,
          tools: settings.tools
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to initialize session');
      }

      const data = await response.json();
      setActiveSessionId(data.sessionId);
      setIsStateful(true);
      setMessages([]);
      setLogs([]);
      loadSessions();
    } catch (err: any) {
      console.error(err);
      alert(`Session Creation Failed: ${err.message}`);
      handleSelectStateless();
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this session logs?')) return;

    try {
      const response = await fetch(`${API_URL}/sessions/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        if (activeSessionId === id) {
          handleSelectStateless();
        }
        loadSessions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = (newSettings: any) => {
    setSettings(newSettings);
    setIsStateful(newSettings.isStateful);
    if (newSettings.isStateful) {
      // Create session with the config directly
      handleCreateSession();
    } else {
      handleSelectStateless();
    }
  };

  const handleQuickStart = (prompt: string) => {
    if (chatInputRef.current) {
      chatInputRef.current.value = prompt;
      chatInputRef.current.focus();
    }
  };

  const addLog = (message: string, type: 'system' | 'tool' | 'result' | 'error', details?: any) => {
    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString(),
        message,
        type,
        details
      }
    ]);
  };

  const submitPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing || !chatInputRef.current) return;

    const promptText = chatInputRef.current.value.trim();
    if (!promptText) return;

    chatInputRef.current.value = '';
    setIsProcessing(true);
    setLogs([]);

    // 1. Add user message
    setMessages((prev) => [...prev, { role: 'user', content: promptText }]);

    // 2. Add blank assistant bubble
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    // Open side panel for logs to keep users informed
    setIsArtifactOpen(true);
    setStatusText(isStateful ? 'Agent is booting...' : 'Temporary sandbox booting...');

    const streamUrl = isStateful 
      ? `${API_URL}/sessions/${activeSessionId}/prompt`
      : `${API_URL}/prompt`;

    try {
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const rawData = line.substring(6);
            try {
              const event = JSON.parse(rawData);

              if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
                const delta = event.assistantMessageEvent.delta;
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.content += delta;
                  }
                  return updated;
                });
              }

              if (event.type === 'agent_start') {
                setStatusText('Planning...');
                addLog('Agent run loop started', 'system');
              }

              if (event.type === 'tool_call') {
                setStatusText(`Running tool: ${event.toolName}`);
                addLog(`Tool Invocation: ${event.toolName}`, 'tool', event);
              }

              if (event.type === 'tool_result') {
                addLog(`Tool returned state: ${event.result?.status || 'success'}`, 'result', event);
              }

              if (event.type === 'error') {
                addLog(`Agent execution error: ${event.message}`, 'error');
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.content += `\n[Runtime Error: ${event.message}]`;
                  }
                  return updated;
                });
              }
            } catch (err) {
              // Fragment buffer error, ignore
            }
          }
        }
      }

      setStatusText('Complete');
      addLog('Agent finished task successfully', 'system');
    } catch (err: any) {
      console.error(err);
      setStatusText('Error');
      addLog(`Failed to run prompt: ${err.message}`, 'error');
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          last.content = `Error connecting to agent: ${err.message}`;
        }
        return updated;
      });
    } finally {
      setIsProcessing(false);
      if (isStateful) loadSessions(); // Refresh metadata list
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar history */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isStateful={isStateful}
        onSelectSession={handleSelectSession}
        onSelectStateless={handleSelectStateless}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* Main chat center */}
      <main className={`chat-area ${isArtifactOpen ? 'panel-open' : ''}`}>
        <header className="chat-header">
          <div className="active-session-info">
            <h2>
              {!activeSessionId && !isStateful 
                ? 'Stateless Sandbox' 
                : `Session: ${activeSessionId?.slice(0, 12) || 'Configuring'}...`}
            </h2>
            <p>
              {!activeSessionId && !isStateful 
                ? `Provider: ${settings.modelProvider} • ${settings.modelId}`
                : `Model: ${settings.modelProvider}/${settings.modelId}`}
            </p>
          </div>
          <div className="header-actions">
            <button 
              onClick={() => setIsArtifactOpen(!isArtifactOpen)}
              className={`btn btn-secondary ${isArtifactOpen ? 'active' : ''}`}
            >
              <Terminal size={15} />
              <span>Workspace Logs {logs.length > 0 && `(${logs.length})`}</span>
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="btn btn-secondary">
              <Settings size={15} />
              <span>Config</span>
            </button>
          </div>
        </header>

        {/* Chat Message History */}
        <section className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-box">
              <h2>Welcome to Pi Provider Console 🤖</h2>
              <p>
                An interactive interface wrapper to orchestrate the terminal-first Pi coding agent.
                You can write prompts to write code, edit directories, compile scripts, and run bash processes in a local sandbox workspace.
              </p>
              <div className="quick-starts">
                <button 
                  onClick={() => handleQuickStart('List the files in the workspace directory.')} 
                  className="quick-start-btn"
                >
                  📁 List directory files
                </button>
                <button 
                  onClick={() => handleQuickStart('Write a hello-world.ts script that logs dates, and run it.')} 
                  className="quick-start-btn"
                >
                  📝 Write and compile TS
                </button>
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((msg, index) => (
                <div key={index} className={`message-row ${msg.role}`}>
                  <span className="message-sender">
                    {msg.role === 'user' ? 'User' : 'Pi Agent'}
                  </span>
                  <div className="message-bubble">
                    {msg.content.trim() === '' ? (
                      <div className="spinner-dots">
                        <span className="dot"></span>
                        <span className="dot"></span>
                        <span className="dot"></span>
                      </div>
                    ) : (
                      <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        {/* Chat Inputs */}
        <footer className="chat-input-container">
          <form onSubmit={submitPrompt} id="chat-form">
            <textarea
              ref={chatInputRef}
              id="chat-input"
              placeholder="Ask the agent to build, run or search..."
              disabled={isProcessing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
            />
            <button 
              type="submit" 
              disabled={isProcessing} 
              className="btn-send"
              style={{ opacity: isProcessing ? 0.6 : 1 }}
            >
              <Send size={16} />
            </button>
          </form>
        </footer>
      </main>

      {/* Artifact/Logs Panel */}
      <ArtifactPanel
        isOpen={isArtifactOpen}
        onClose={() => setIsArtifactOpen(false)}
        logs={logs}
        statusText={statusText}
        isProcessing={isProcessing}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        initialSettings={settings}
      />
    </div>
  );
}
