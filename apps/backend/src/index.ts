import { serve } from '@hono/node-server';
import { createApp } from './app';
import { closeDb, initializeDb } from './db';

// Configuration
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Main entry point
 */
async function main() {
  console.log('[Like Cake] Starting backend server...');

  // Initialize database
  initializeDb();

  // Create app
  const app = createApp();

  // Start server
  const server = serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  });

  console.log(`[Like Cake] Server running at http://${HOST}:${PORT}`);
  console.log(`[Like Cake] API available at http://localhost:${PORT}/api`);

  // Graceful shutdown
  const shutdown = () => {
    console.log('[Like Cake] Shutting down...');
    closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

main().catch((error) => {
  console.error('[Like Cake] Failed to start server:', error);
  process.exit(1);
});
