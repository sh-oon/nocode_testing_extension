import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        devtools: 'src/devtools/devtools.html',
        panel: 'src/devtools/panel.html',
        sidepanel: 'src/sidepanel/sidepanel.html',
      },
      output: {
        manualChunks(id): string | undefined {
          if (id.includes('@xyflow')) {
            return 'vendor-xyflow';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
