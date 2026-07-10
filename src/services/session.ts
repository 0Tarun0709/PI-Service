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
   * Spins up a new programmatically controlled agent session
   */
  async create(options: CreateSessionOptions) {
    const modelProvider = options.modelProvider || config.defaultProvider;
    const modelId = options.modelId || config.defaultModel;
    const systemPrompt = options.systemPrompt || config.defaultSystemPrompt;
    const tools = options.tools || config.defaultTools;

    // Resolve workspace directory
    const rawWorkspacePath = options.workspacePath || `./workspace-${Date.now()}`;
    const workspacePath = resolve(process.cwd(), rawWorkspacePath);

    if (!existsSync(workspacePath)) {
      mkdirSync(workspacePath, { recursive: true });
    }

    const authStorage = AuthStorage.create();
    
    // Resolve API key using config helper
    const apiKey = config.getApiKey(modelProvider, options.apiKey);

    if (apiKey) {
      authStorage.setRuntimeApiKey(modelProvider, apiKey);
    }

    const modelRegistry = ModelRegistry.inMemory(authStorage);
    const model = modelRegistry.find(modelProvider, modelId);
    if (!model) {
      throw new Error(`Model not found or not supported for provider '${modelProvider}' and id '${modelId}'.`);
    }

    // Build the resource loader dynamically to support custom system prompts
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

    return {
      sessionId,
      workspacePath,
      model: `${modelProvider}/${modelId}`,
      allowedTools: tools
    };
  }

  /**
   * Retrieves an active session entry by ID
   */
  get(id: string): SessionEntry | undefined {
    return this.activeSessions.get(id);
  }

  /**
   * Lists all active session details
   */
  list() {
    return Array.from(this.activeSessions.entries()).map(([id, entry]) => ({
      sessionId: id,
      workspacePath: entry.workspacePath,
      messageCount: entry.session.state.messages.length
    }));
  }

  /**
   * Disposes of and removes an active session
   */
  delete(id: string): boolean {
    const entry = this.activeSessions.get(id);
    if (!entry) return false;

    entry.session.dispose();
    this.activeSessions.delete(id);
    return true;
  }
}
