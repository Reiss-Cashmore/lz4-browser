import { defineConfig } from 'vite';

export default defineConfig({
  root: 'examples',
  server: {
    port: 5173
  },
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true
  }
});
