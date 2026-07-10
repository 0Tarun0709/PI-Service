import type { FastifyInstance } from 'fastify';
import { SessionService, type CreateSessionOptions } from '../services/session.js';

export async function sessionRoutes(fastify: FastifyInstance, options: { sessionService: SessionService }) {
  const { sessionService } = options;

  // List all active sessions
  fastify.get('/sessions', async () => {
    return sessionService.list();
  });

  // Create a new session
  fastify.post('/sessions', async (request, reply) => {
    const body = (request.body || {}) as CreateSessionOptions;
    try {
      const sessionInfo = await sessionService.create(body);
      return reply.status(201).send({
        status: 'created',
        ...sessionInfo
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message || 'Failed to create session' });
    }
  });

  // Prompt a session (SSE stream)
  fastify.post('/sessions/:id/prompt', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { prompt: string };

    if (!body.prompt) {
      return reply.status(400).send({ error: 'Prompt is required' });
    }

    const entry = sessionService.get(id);
    if (!entry) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    const { session } = entry;

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Stream events live to the caller
    const unsubscribe = session.subscribe((event: any) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    try {
      await session.prompt(body.prompt);
    } catch (err: any) {
      fastify.log.error(err);
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    } finally {
      unsubscribe();
      reply.raw.end();
    }

    reply.sent = true;
  });

  // Get session status and message history
  fastify.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const entry = sessionService.get(id);
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

  // Delete/dispose a session
  fastify.delete('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = sessionService.delete(id);
    if (!success) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    return { status: 'disposed', sessionId: id };
  });
}
