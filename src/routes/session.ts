import type { FastifyInstance } from 'fastify';
import { rmSync, existsSync } from 'node:fs';
import { SessionService, type CreateSessionOptions } from '../services/session.js';

export async function sessionRoutes(fastify: FastifyInstance, options: { sessionService: SessionService }) {
  const { sessionService } = options;

  // List all active and historical sessions from SQLite
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

  // Prompt a session (SSE stream) and persist history in SQLite
  fastify.post('/sessions/:id/prompt', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { prompt: string };

    if (!body.prompt) {
      return reply.status(400).send({ error: 'Prompt is required' });
    }

    const entry = sessionService.getLive(id);
    if (!entry) {
      return reply.status(404).send({ error: 'Active session not found or already closed' });
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
      // Save full updated conversation to SQLite
      sessionService.saveMessages(id, session.state.messages);
    }

    reply.sent = true;
  });

  // Get session status and message history (works for both active and disposed sessions)
  fastify.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const sessionInfo = sessionService.get(id);
    if (!sessionInfo) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    return sessionInfo;
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

  // Single-use prompt (creates, streams, auto-saves to DB, and completely deletes workspace)
  fastify.post('/prompt', async (request, reply) => {
    const body = (request.body || {}) as { prompt: string };

    if (!body.prompt) {
      return reply.status(400).send({ error: 'Prompt is required' });
    }

    let sessionInfo;
    try {
      sessionInfo = await sessionService.create({});
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message || 'Failed to create temporary session' });
    }

    const { sessionId } = sessionInfo;
    const entry = sessionService.getLive(sessionId);
    if (!entry) {
      return reply.status(500).send({ error: 'Failed to find created session' });
    }

    const { session, workspacePath } = entry;

    // Set up SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

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
      
      // 1. Persist the final message history in SQLite
      sessionService.saveMessages(sessionId, session.state.messages);

      // 2. Auto-dispose/close the session handles
      sessionService.delete(sessionId);

      // 3. Delete the temporary directory from disk
      try {
        if (existsSync(workspacePath)) {
          rmSync(workspacePath, { recursive: true, force: true });
        }
      } catch (fsErr) {
        fastify.log.error(fsErr, 'Failed to clean up temporary workspace folder');
      }
    }

    reply.sent = true;
  });
}
