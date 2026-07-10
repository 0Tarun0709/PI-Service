import React, { useState } from 'react';
import { Terminal, FileText, X, AlertCircle } from 'lucide-react';

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'system' | 'tool' | 'result' | 'error';
  details?: any;
}

interface ArtifactPanelProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  statusText: string;
  isProcessing: boolean;
}

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  isOpen,
  onClose,
  logs,
  statusText,
  isProcessing
}) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'shell'>('logs');

  if (!isOpen) return null;

  // Extract bash execution output logs for a quick console-view
  const bashOutputs = logs
    .filter(log => log.type === 'tool' && log.message.includes('bash') || log.type === 'result')
    .map(log => {
      if (log.type === 'tool') {
        const cmd = log.details?.input || '';
        return `\n$ ${cmd}`;
      }
      // Result print out
      if (log.details?.result?.content) {
        const textContent = log.details.result.content
          .map((c: any) => c.text || '')
          .join('\n');
        return textContent;
      }
      return '';
    })
    .join('\n');

  return (
    <div className="artifact-panel animate-slide-left">
      {/* Header */}
      <div className="artifact-header">
        <div className="artifact-title-group">
          <Terminal size={16} className="artifact-header-icon" />
          <span className="artifact-title">Agent Workspace Workspace</span>
        </div>
        <button type="button" onClick={onClose} className="artifact-close-btn" title="Close Panel">
          <X size={16} />
        </button>
      </div>

      {/* Status Bar */}
      <div className="artifact-status-bar">
        {isProcessing && <span className="pulse-indicator-small" />}
        <span className="status-message">{statusText}</span>
      </div>

      {/* Tabs */}
      <div className="artifact-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`artifact-tab ${activeTab === 'logs' ? 'active' : ''}`}
        >
          <FileText size={14} />
          <span>Activity Log</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('shell')}
          className={`artifact-tab ${activeTab === 'shell' ? 'active' : ''}`}
        >
          <Terminal size={14} />
          <span>Shell Output</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="artifact-body">
        {activeTab === 'logs' ? (
          <div className="logs-panel">
            {logs.length === 0 ? (
              <div className="empty-panel-text">No activity logs recorded yet.</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`log-row ${log.type}`}>
                  <span className="log-time">[{log.timestamp}]</span>
                  <span className="log-msg">{log.message}</span>
                  {log.type === 'error' && (
                    <div className="log-err-alert">
                      <AlertCircle size={12} />
                      <span>{log.message}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="shell-panel">
            {bashOutputs.trim() === '' ? (
              <div className="empty-panel-text">No shell command executions observed yet.</div>
            ) : (
              <pre className="terminal-stdout">
                <code>{bashOutputs}</code>
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
