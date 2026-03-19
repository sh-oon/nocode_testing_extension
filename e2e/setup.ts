import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * Creates a simple static file server to serve test fixture pages.
 * Returns the server instance and the base URL.
 */
export function createFixtureServer(fixtureDir: string): Promise<{
  server: http.Server;
  baseUrl: string;
  close: () => Promise<void>;
}> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url === '/' ? '/test-page.html' : (req.url ?? '/');
      const filePath = path.join(fixtureDir, urlPath.split('?')[0]);

      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
      const content = fs.readFileSync(filePath);

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }

      const baseUrl = `http://127.0.0.1:${address.port}`;

      const close = (): Promise<void> =>
        new Promise((resolveClose) => {
          server.close(() => resolveClose());
        });

      resolve({ server, baseUrl, close });
    });

    server.on('error', reject);
  });
}
