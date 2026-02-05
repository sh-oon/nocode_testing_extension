import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { createApp } from './app';
import { closeDb, initializeDb } from './db';
import { executionService } from './services/execution.service';

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

  // Create WebSocket server for execution progress
  const wss = new WebSocketServer({ server: server as Server, path: '/ws/execution' });

  wss.on('connection', (ws) => {
    console.log('[Like Cake] WebSocket client connected');

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'subscribe' && message.executionId) {
          const subscribed = executionService.subscribe(message.executionId, ws);
          ws.send(
            JSON.stringify({
              type: 'subscribed',
              executionId: message.executionId,
              success: subscribed,
            })
          );
        }

        if (message.type === 'unsubscribe' && message.executionId) {
          executionService.unsubscribe(message.executionId, ws);
          ws.send(
            JSON.stringify({
              type: 'unsubscribed',
              executionId: message.executionId,
            })
          );
        }
      } catch {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      console.log('[Like Cake] WebSocket client disconnected');
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to execution WebSocket' }));
  });

  console.log(`[Like Cake] Server running at http://${HOST}:${PORT}`);
  console.log(`[Like Cake] API available at http://localhost:${PORT}/api`);
  console.log(`[Like Cake] WebSocket available at ws://localhost:${PORT}/ws/execution`);

  // Graceful shutdown
  const shutdown = () => {
    console.log('[Like Cake] Shutting down...');
    wss.close();
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
