import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    '@like-cake/ast-types',
    '@like-cake/api-interceptor',
    '@like-cake/dom-serializer',
    '@like-cake/diff-engine',
  ],
});
