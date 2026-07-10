import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { ArtifactPanel, type LogEntry } from './components/ArtifactPanel';
import { Send, Settings, Terminal, ChevronDown, ChevronRight, CheckCircle2, Paperclip, Box, AlertCircle } from 'lucide-react';
import './App.css';
import configJson from '../../config.json';

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
  
  // Expanded states for Tool Cards
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  // Modals & Panels toggle
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isArtifactOpen, setIsArtifactOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    modelProvider: configJson.defaultProvider || 'openrouter',
    modelId: configJson.defaultModel || 'cohere/north-mini-code:free',
    systemPrompt: configJson.defaultSystemPrompt || 'You are Wayne, a general-purpose AI assistant. Only execute tools when specifically requested by the user.',
    tools: configJson.defaultTools || ['read', 'write', 'edit', 'ls', 'grep', 'bash'],
    workspacePath: '',
    isStateful: false
  });

  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, logs]);

  const toggleTool = (toolId: string) => {
    setExpandedTools(prev => ({ ...prev, [toolId]: !prev[toolId] }));
  };

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
    chatInputRef.current.style.height = 'auto';
    setIsProcessing(true);
    setLogs([]);

    setMessages((prev) => [...prev, { role: 'user', content: promptText }]);
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

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

      if (!response.ok) throw new Error(await response.text());
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
                  const idx = updated.length - 1;
                  const last = updated[idx];
                  if (last && last.role === 'assistant') {
                    updated[idx] = { ...last, content: last.content + delta };
                  }
                  return updated;
                });
                
                // If it streams an artifact tag, open the right pane
                if (delta.includes('<antArtifact') || delta.includes('```')) {
                  setIsArtifactOpen(true);
                }
              }

              if (event.type === 'tool_execution_start') {
                setStatusText(`Running tool: ${event.toolName}`);
                const argsStr = event.args ? JSON.stringify(event.args) : '';
                addLog(`Tool Invocation: ${event.toolName} (Args: ${argsStr})`, 'tool', event);
                // Open drawer by default when starting
                setExpandedTools(prev => ({ ...prev, [event.toolCallId || event.toolName]: true }));
              }

              if (event.type === 'tool_execution_end') {
                const status = event.isError ? 'error' : 'success';
                addLog(`Tool completed: ${event.toolName} (${status})`, 'result', event);
                // Close drawer when finished to keep UI clean
                setExpandedTools(prev => ({ ...prev, [event.toolCallId || event.toolName]: false }));
              }

              if (event.type === 'error' || event.type === 'auto_retry_start' || event.type === 'auto_retry_end') {
                const isRetry = event.type.startsWith('auto_retry');
                const errorMsg = isRetry ? event.errorMessage || event.finalError : event.message;
                const logLabel = event.type === 'auto_retry_start' ? `Retrying: ${errorMsg}` : `Agent error: ${errorMsg}`;
                
                addLog(logLabel, 'error');
                
                if (event.type === 'error' || event.type === 'auto_retry_end') {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const idx = updated.length - 1;
                    const last = updated[idx];
                    if (last && last.role === 'assistant') {
                      updated[idx] = { ...last, content: last.content + `\n\n> ⚠️ **Provider Error:** ${errorMsg}` };
                    }
                    return updated;
                  });
                }
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
        const idx = updated.length - 1;
        const last = updated[idx];
        if (last && last.role === 'assistant') {
          updated[idx] = { ...last, content: `Error connecting to agent: ${err.message}` };
        }
        return updated;
      });
    } finally {
      setIsProcessing(false);
      if (isStateful) loadSessions();
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitPrompt(e as unknown as React.FormEvent);
    }
  };

  const formatToolResult = (result: any) => {
    if (!result) return '';
    if (typeof result === 'string') return result;
    if (result.stdout !== undefined || result.stderr !== undefined) {
      let out = result.stdout || '';
      if (result.stderr) {
        out += `\nError:\n${result.stderr}`;
      }
      return out.trim();
    }
    if (Array.isArray(result.content)) {
      return result.content.map((c: any) => c.text || JSON.stringify(c)).join('\n').trim();
    }
    return JSON.stringify(result, null, 2);
  };

  return (
    <div className={`app-container ${darkMode ? 'dark' : ''}`}>
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

      {/* Main Chat Workspace */}
      <main className="main-chat">
        <section className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-box">
              <h2>Good afternoon</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                I'm Wayne, your AI assistant.
              </p>
              <div className="quick-starts">
                <button onClick={() => handleQuickStart('List the files in the workspace directory.')} className="quick-start-btn">
                  📁 List directory files
                </button>
                <button onClick={() => handleQuickStart('Write a hello-world.ts script that logs dates, and run it.')} className="quick-start-btn">
                  📝 Write and compile TS
                </button>
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((msg, index) => (
                <div key={index} className={`message-row ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}>
                  <span className="message-sender">
                    {msg.role === 'user' ? 'You' : (
                      <>
                        <Box size={16} /> Wayne
                      </>
                    )}
                  </span>
                  <div className="message-bubble">
                    {msg.content.trim() === '' && logs.length === 0 ? (
                      <div className="spinner-dots">
                        <span className="dot"></span>
                        <span className="dot"></span>
                        <span className="dot"></span>
                      </div>
                    ) : (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    )}
                    
                    {/* Tool Integration Web Cards */}
                    {msg.role === 'assistant' && index === messages.length - 1 && logs.filter(l => l.type === 'tool').length > 0 && (
                      <div className="tool-executions">
                        {logs.filter(l => l.type === 'tool').map((startLog, lIdx) => {
                          const toolCallId = startLog.details?.toolCallId || startLog.details?.toolName;
                          const isExpanded = expandedTools[toolCallId] || false;
                          const resultLog = logs.find(l => l.type === 'result' && (l.details?.toolCallId === toolCallId || l.details?.toolName === startLog.details?.toolName));
                          
                          const toolName = startLog.details?.toolName || 'bash';
                          const statusLabel = resultLog ? (resultLog.details?.isError ? 'Failed' : 'Executed') : 'Running...';
                          
                          return (
                            <div key={lIdx} className={`tool-card ${isExpanded ? 'expanded' : ''} ${resultLog?.details?.isError ? 'error' : ''}`}>
                              <div className="tool-header" onClick={() => toggleTool(toolCallId)}>
                                {isExpanded ? <ChevronDown size={16} className="tool-icon"/> : <ChevronRight size={16} className="tool-icon"/>}
                                <Terminal size={14} className="tool-icon" />
                                <span className="tool-title">{resultLog ? `Ran tool: ${toolName}` : `Running ${toolName}...`}</span>
                                <span className="tool-status">
                                  {resultLog ? (resultLog.details?.isError ? <AlertCircle size={14}/> : <CheckCircle2 size={14} className="tool-icon" style={{color: 'var(--accent)'}}/>) : <span className="spinner"></span>}
                                  <span style={{marginLeft: 4}}>{statusLabel}</span>
                                </span>
                              </div>
                              {isExpanded && (
                                <div className="tool-body">
                                  <pre>
                                    {resultLog
                                      ? formatToolResult(resultLog.details?.result) || 'Success (no output)'
                                      : startLog.details?.args ? JSON.stringify(startLog.details.args, null, 2) : 'Executing...'}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} style={{height: 40}} />
            </div>
          )}
        </section>

        {/* Floating Input Container */}
        <footer className="chat-input-container">
          <form onSubmit={submitPrompt} id="chat-form">
            <textarea
              ref={chatInputRef}
              id="chat-input"
              placeholder={isProcessing ? "Wayne is thinking..." : "How can Wayne help you today?"}
              disabled={isProcessing}
              rows={1}
              onChange={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={handleInputKeyDown}
            />
            <div className="chat-input-actions">
              <div className="chat-input-left">
                <button type="button" className="action-btn" title="Add File">
                  <Paperclip size={18} />
                </button>
                <button type="button" className="action-btn" onClick={() => setIsSettingsOpen(true)} title="Config">
                  <Settings size={18} />
                </button>
              </div>
              <button 
                type="submit" 
                className="submit-btn" 
                disabled={isProcessing}
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </footer>
      </main>

      {/* Artifacts Split Panel */}
      <ArtifactPanel
        isOpen={isArtifactOpen}
        onClose={() => setIsArtifactOpen(false)}
        logs={logs}
        statusText={statusText}
        isProcessing={isProcessing}
      />

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          initialSettings={settings}
          onSave={handleSaveSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
