import fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
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

dotenv.config();

const app = fastify({ logger: true });

// Setup CORS
await app.register(cors, { origin: '*' });

// Keep track of active sessions
interface SessionEntry {
  session: any;
  workspacePath: string;
}
const activeSessions = new Map<string, SessionEntry>();

// Healthcheck / Root info
app.get('/', async () => {
  return {
    status: 'healthy',
    service: 'Pi Provider Service',
    activeSessionCount: activeSessions.size
  };
});

// Create a new session
app.post('/api/sessions', async (request, reply) => {
  const body = (request.body || {}) as {
    modelProvider?: string;
    modelId?: string;
    workspacePath?: string;
    systemPrompt?: string;
    tools?: string[];
    apiKey?: string;
  };

  const modelProvider = body.modelProvider || 'google';
  const modelId = body.modelId || 'gemini-2.5-flash';
  const systemPrompt = body.systemPrompt || 'You are an autonomous AI coding agent.';
  const tools = body.tools || ['read', 'write', 'edit', 'ls', 'grep', 'bash'];
  
  // Resolve workspace path relative to current dir
  const rawWorkspacePath = body.workspacePath || `./workspace-${Date.now()}`;
  const workspacePath = resolve(process.cwd(), rawWorkspacePath);
  
  if (!existsSync(workspacePath)) {
    mkdirSync(workspacePath, { recursive: true });
  }

  try {
    const authStorage = AuthStorage.create();
    
    // Resolve API key
    const apiKey = body.apiKey || 
      process.env[`${modelProvider.toUpperCase()}_API_KEY`] || 
      process.env[`${modelProvider.toUpperCase()}_KEY`] || 
      '';
      
    if (apiKey) {
      authStorage.setRuntimeApiKey(modelProvider, apiKey);
    } else {
      // If no key is set, log a warning but proceed (local models or preset system credentials might be active)
      app.log.warn(`No API key provided or found in environment variables for provider: ${modelProvider}`);
    }

    const modelRegistry = ModelRegistry.inMemory(authStorage);
    const model = modelRegistry.find(modelProvider, modelId);
    if (!model) {
      return reply.status(400).send({
        error: `Model not found or not supported for provider '${modelProvider}' and id '${modelId}'.`
      });
    }

    // Build the resource loader to enforce system prompt overrides
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
    activeSessions.set(sessionId, { session, workspacePath });

    return {
      status: 'created',
      sessionId,
      workspacePath,
      model: `${modelProvider}/${modelId}`,
      allowedTools: tools
    };
  } catch (error: any) {
    app.log.error(error);
    return reply.status(500).send({ error: error.message || 'Failed to create agent session' });
  }
});

// Prompt a session and stream events back using SSE
app.post('/api/sessions/:id/prompt', async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body || {}) as { prompt: string };
  
  if (!body.prompt) {
    return reply.status(400).send({ error: 'Prompt is required' });
  }

  const entry = activeSessions.get(id);
  if (!entry) {
    return reply.status(404).send({ error: 'Session not found' });
  }

  const { session } = entry;

  // Set up Server-Sent Events headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Subscribe to agent session events and stream them live
  const unsubscribe = session.subscribe((event: any) => {
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  try {
    await session.prompt(body.prompt);
  } catch (err: any) {
    app.log.error(err);
    reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
  } finally {
    unsubscribe();
    reply.raw.end();
  }

  // Tells Fastify we are manually managing the response output
  reply.sent = true;
});

// Get session details and prompt logs
app.get('/api/sessions/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const entry = activeSessions.get(id);
  if (!entry) {
    return reply.status(404).send({ error: 'Session not found' });
  }

  return {
    sessionId: entry.session.sessionId,
    workspacePath: entry.workspacePath,
    messageCount: entry.session.state.messages.length,
    messages: entry.session.state.messages
  };
});

// Delete / Dispose of a session
app.delete('/api/sessions/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const entry = activeSessions.get(id);
  if (!entry) {
    return reply.status(404).send({ error: 'Session not found' });
  }

  try {
    entry.session.dispose();
    activeSessions.delete(id);
    return { status: 'disposed', sessionId: id };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message || 'Failed to dispose session' });
  }
});

// Start fastify server
const PORT = Number(process.env.PORT) || 3000;
const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Pi Provider API is running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
