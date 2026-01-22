import { Hono } from 'hono';
import { getCurrentDb } from '../db';

const health = new Hono();

/**
 * Health check endpoint
 */
health.get('/', (c) => {
  const db = getCurrentDb();

  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected',
    version: '1.0.0',
  });
});

/**
 * Readiness check (for kubernetes)
 */
health.get('/ready', (c) => {
  const db = getCurrentDb();

  if (!db) {
    return c.json({ status: 'not ready', reason: 'database not connected' }, 503);
  }

  return c.json({ status: 'ready' });
});

/**
 * Liveness check (for kubernetes)
 */
health.get('/live', (c) => {
  return c.json({ status: 'alive' });
});

export { health };
