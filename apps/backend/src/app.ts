import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { routes } from './routes';

/**
 * Create and configure the Hono application
 */
export function createApp() {
  const app = new Hono();

  // Middleware
  app.use('*', logger());
  app.use('*', prettyJSON());
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: (origin) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return 'http://localhost:3000';

        // Allow localhost development
        if (origin.startsWith('http://localhost:')) return origin;

        // Allow Chrome Extension origins
        if (origin.startsWith('chrome-extension://')) return origin;

        // Default: deny
        return null;
      },
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true,
    })
  );

  // Root endpoint
  app.get('/', (c) => {
    return c.json({
      name: 'Like Cake Backend',
      version: '1.0.0',
      description: 'Backend API for E2E test automation',
      docs: '/api/health',
    });
  });

  // Mount API routes
  app.route('/api', routes);

  // 404 handler
  app.notFound((c) => {
    return c.json(
      {
        success: false,
        error: 'Not Found',
        path: c.req.path,
      },
      404
    );
  });

  // Error handler
  app.onError((err, c) => {
    console.error('[Like Cake] Error:', err);

    return c.json(
      {
        success: false,
        error: err.message || 'Internal Server Error',
      },
      500
    );
  });

  return app;
}
