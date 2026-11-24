import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/engine/index.ts',
      formats: ['es'],
      fileName: () => 'engine-bundle.mjs',
    },
    outDir: 'mcp-server',
    emptyOutDir: false,
    minify: false,
  },
});
