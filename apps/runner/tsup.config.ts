import { defineConfig } from 'tsup';

export default defineConfig([
  // Main library bundle
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node20',
    external: ['puppeteer'],
  },
  // CLI bundle with shebang
  {
    entry: {
      cli: 'src/cli.ts',
    },
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    target: 'node20',
    external: ['puppeteer'],
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
