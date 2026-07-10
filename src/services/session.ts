import { resolve, join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
  createExtensionRuntime,
  type ResourceLoader
} from '@earendil-works/pi-coding-agent';
import { config } from '../config.js';
import {
  saveSession,
  saveSessionMessages,
  updateSessionStatusAndMessages,
  updateSessionStatus,
  getSession,
  listSessions
} from '../db/index.js';

export interface CreateSessionOptions {
  modelProvider?: string;
  modelId?: string;
  workspacePath?: string;
  systemPrompt?: string;
  tools?: string[];
  apiKey?: string;
}

export interface SessionEntry {
  session: any;
  workspacePath: string;
}

export class SessionService {
  private activeSessions = new Map<string, SessionEntry>();

  /**
   * Spins up a new programmatically controlled agent session and logs it to SQLite
   */
  async create(options: CreateSessionOptions) {
    const modelProvider = options.modelProvider || config.defaultProvider;
    const modelId = options.modelId || config.defaultModel;
    const systemPrompt = options.systemPrompt || config.defaultSystemPrompt;
    const tools = options.tools || config.defaultTools;

    // Resolve workspace directory
    const rawWorkspacePath = options.workspacePath || `./.tmp/workspace-${Date.now()}`;
    const workspacePath = resolve(process.cwd(), rawWorkspacePath);

    if (!existsSync(workspacePath)) {
      mkdirSync(workspacePath, { recursive: true });
    }

    const authStorage = AuthStorage.create();
    const apiKey = config.getApiKey(modelProvider, options.apiKey);

    if (apiKey) {
      authStorage.setRuntimeApiKey(modelProvider, apiKey);
    }

    const modelRegistry = ModelRegistry.inMemory(authStorage);
    const model = modelRegistry.find(modelProvider, modelId);
    if (!model) {
      throw new Error(`Model not found or not supported for provider '${modelProvider}' and id '${modelId}'.`);
    }

    const resourceLoader: ResourceLoader = {
      getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
      getSkills: () => ({ skills: [], diagnostics: [] }),
      getPrompts: () => ({ prompts: [], diagnostics: [] }),
      getThemes: () => ({ themes: [], diagnostics: [] }),
      getAgentsFiles: () => ({ agentsFiles: [] }),
      getSystemPrompt: () => systemPrompt,
      getAppendSystemPrompt: () => [],
      extendResources: () => {},
      reload: async () => {},
    };

    const { session } = await createAgentSession({
      cwd: workspacePath,
      agentDir: join(workspacePath, '.pi'),
      model,
      thinkingLevel: 'off',
      authStorage,
      modelRegistry,
      resourceLoader,
      tools,
      sessionManager: SessionManager.inMemory(workspacePath),
    });

    const sessionId = session.sessionId;
    this.activeSessions.set(sessionId, { session, workspacePath });

    // Save initial session record in SQLite
    saveSession(sessionId, workspacePath, `${modelProvider}/${modelId}`, 'active');

    return {
      sessionId,
      workspacePath,
      model: `${modelProvider}/${modelId}`,
      allowedTools: tools
    };
  }

  /**
   * Updates the message logs for a session in the SQLite database
   */
  saveMessages(id: string, messages: any[]) {
    saveSessionMessages(id, messages);
  }

  /**
   * Retrieves an active live session entry
   */
  getLive(id: string): SessionEntry | undefined {
    return this.activeSessions.get(id);
  }

  /**
   * Retrieves a session from active memory or falls back to SQLite records
   */
  get(id: string) {
    // 1. Check live sessions in memory
    const active = this.activeSessions.get(id);
    if (active) {
      return {
        sessionId: active.session.sessionId,
        workspacePath: active.workspacePath,
        status: 'active',
        messages: active.session.state.messages
      };
    }

    // 2. Fallback: Query SQLite database
    return getSession(id);
  }

  /**
   * Lists all session metadata records from SQLite
   */
  list() {
    return listSessions();
  }

  /**
   * Disposes of the active session, updates SQLite status, and persists final history logs
   */
  delete(id: string): boolean {
    const entry = this.activeSessions.get(id);
    if (!entry) {
      // If it's already deleted in memory, we can mark it as disposed in DB if it was active
      return updateSessionStatus(id, 'disposed');
    }

    try {
      const messages = entry.session.state.messages;
      
      // Save final message log and update status to disposed
      updateSessionStatusAndMessages(id, 'disposed', messages);

      // Clean up in-memory handles
      entry.session.dispose();
      this.activeSessions.delete(id);
      
      return true;
    } catch (err) {
      console.error(`Failed to dispose session ${id}:`, err);
      return false;
    }
  }
}
