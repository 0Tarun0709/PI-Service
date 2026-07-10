import React from 'react';
import { Plus, MessageSquare, Trash2, Layers } from 'lucide-react';

interface Session {
  id: string;
  workspace_path: string;
  model: string;
  status: string;
  created_at: string;
}

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  isStateful: boolean;
  onSelectSession: (id: string) => void;
  onSelectStateless: () => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  isStateful,
  onSelectSession,
  onSelectStateless,
  onCreateSession,
  onDeleteSession,
  darkMode,
  setDarkMode
}) => {
  return (
    <aside className="sidebar-container">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <div className="sidebar-logo">
            <span className="logo-badge">π</span>
            <span>Pi Provider</span>
          </div>
          <button 
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="theme-toggle-btn"
            title="Toggle Theme"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
        <button 
          type="button"
          onClick={onCreateSession}
          className="btn-new-session"
        >
          <Plus size={16} />
          <span>New Stateful Session</span>
        </button>
      </div>

      {/* Navigation & History */}
      <div className="sidebar-scrollable">
        {/* Playgrounds Section */}
        <div className="sidebar-section">
          <h3 className="section-title">Playgrounds</h3>
          <button
            type="button"
            onClick={onSelectStateless}
            className={`playground-btn ${!activeSessionId && !isStateful ? 'active' : ''}`}
          >
            <Layers size={16} className="playground-icon" />
            <div className="playground-btn-text">
              <span className="playground-title">Stateless Sandbox</span>
              <span className="playground-subtitle">Clean workspace, auto-cleanup</span>
            </div>
          </button>
        </div>

        {/* Sessions Section */}
        <div className="sidebar-section">
          <h3 className="section-title">Session Logs</h3>
          <ul className="session-items-list">
            {sessions.length === 0 ? (
              <li className="session-empty-text">No persistent sessions</li>
            ) : (
              sessions.map((session) => {
                const isActive = activeSessionId === session.id;
                return (
                  <li key={session.id}>
                    <div
                      onClick={() => onSelectSession(session.id)}
                      className={`session-item-card ${isActive ? 'active' : ''}`}
                    >
                      <div className="session-item-info">
                        <MessageSquare 
                          size={15} 
                          className={`session-icon ${isActive ? 'active' : ''}`} 
                        />
                        <div className="session-name-group">
                          <span className="session-id-text" title={session.id}>
                            {session.id.slice(0, 14)}...
                          </span>
                          <span className="session-model-text">
                            {session.model.split('/').pop()}
                          </span>
                        </div>
                      </div>
                      <div className="session-item-actions">
                        <span 
                          className={`status-indicator ${session.status}`}
                          title={session.status}
                        />
                        <button
                          type="button"
                          onClick={(e) => onDeleteSession(session.id, e)}
                          className="session-delete-btn"
                          title="Delete Session"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </aside>
  );
};
