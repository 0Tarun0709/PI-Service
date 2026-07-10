import fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { SessionService } from './services/session.js';
import { sessionRoutes } from './routes/session.js';

dotenv.config();

const app = fastify({ logger: true });

// Setup CORS
await app.register(cors, { origin: '*' });

// Initialize Session Service
const sessionService = new SessionService();

// Register session routes under the '/api' prefix
await app.register(sessionRoutes, { prefix: '/api', sessionService });

// Healthcheck / Root info
app.get('/', async () => {
  return {
    status: 'healthy',
    service: 'Pi Provider Service',
    activeSessionCount: sessionService.list().length
  };
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
