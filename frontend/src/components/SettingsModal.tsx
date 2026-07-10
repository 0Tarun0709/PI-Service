import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Settings {
  modelProvider: string;
  modelId: string;
  systemPrompt: string;
  tools: string[];
  workspacePath: string;
  isStateful: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  initialSettings: Settings;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSettings
}) => {
  const [provider, setProvider] = useState(initialSettings.modelProvider);
  const [modelId, setModelId] = useState(initialSettings.modelId);
  const [systemPrompt, setSystemPrompt] = useState(initialSettings.systemPrompt);
  const [workspacePath, setWorkspacePath] = useState(initialSettings.workspacePath);
  const [isStateful, setIsStateful] = useState(initialSettings.isStateful);
  const [selectedTools, setSelectedTools] = useState<string[]>(initialSettings.tools);

  if (!isOpen) return null;

  const toolsList = ['read', 'write', 'edit', 'ls', 'grep', 'bash'];

  const handleToolToggle = (tool: string) => {
    if (selectedTools.includes(tool)) {
      setSelectedTools(selectedTools.filter((t) => t !== tool));
    } else {
      setSelectedTools([...selectedTools, tool]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      modelProvider: provider,
      modelId,
      systemPrompt,
      tools: selectedTools,
      workspacePath,
      isStateful
    });
    onClose();
  };

  return (
    <div className="drawer-overlay">
      <div className="drawer-backdrop" onClick={onClose}></div>
      <div className="drawer-content-box animate-slide-in">
        <div className="drawer-header">
          <h3>Session Config</h3>
          <button type="button" onClick={onClose} className="drawer-close-btn">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="drawer-form">
          <div className="form-group">
            <label htmlFor="modal-provider">Model Provider</label>
            <select 
              id="modal-provider"
              value={provider} 
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="openrouter">OpenRouter</option>
              <option value="google">Google Gemini</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="openai">OpenAI GPT</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="modal-model-id">Model ID</label>
            <input 
              id="modal-model-id"
              type="text" 
              value={modelId} 
              onChange={(e) => setModelId(e.target.value)}
              placeholder="poolside/laguna-xs-2.1:free"
            />
          </div>

          <div className="form-group">
            <label htmlFor="modal-workspace">Workspace Path</label>
            <input 
              id="modal-workspace"
              type="text" 
              value={workspacePath} 
              onChange={(e) => setWorkspacePath(e.target.value)}
              placeholder="./workspace-custom"
            />
            <span className="help-text-span">Leave blank to use a dynamic temp folder</span>
          </div>

          <div className="form-group">
            <label htmlFor="modal-system">System Prompt</label>
            <textarea 
              id="modal-system"
              value={systemPrompt} 
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
            />
          </div>

          <div className="form-group checkbox-row">
            <input 
              id="modal-stateful"
              type="checkbox" 
              checked={isStateful}
              onChange={(e) => setIsStateful(e.target.checked)}
            />
            <label htmlFor="modal-stateful" className="checkbox-label">
              Persistent Session (Stateful)
            </label>
          </div>

          <div className="form-group">
            <label>Allowed Agent Tools</label>
            <div className="tools-selection-grid">
              {toolsList.map((tool) => (
                <div key={tool} className="tool-checkbox-item">
                  <input 
                    id={`tool-${tool}`}
                    type="checkbox" 
                    checked={selectedTools.includes(tool)}
                    onChange={() => handleToolToggle(tool)}
                  />
                  <label htmlFor={`tool-${tool}`}>{tool}</label>
                </div>
              ))}
            </div>
          </div>

          <div className="drawer-warning-block">
            Persistent sessions write state logs in SQLite and preserve the workspace folder on your disk. Stateless runs clean up all workspace files automatically.
          </div>

          <button type="submit" className="btn-save-config">
            Apply Configuration
          </button>
        </form>
      </div>
    </div>
  );
};
