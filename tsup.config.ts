import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: ['es2018', 'node12'],
  treeshake: true,
  minify: false,
  splitting: false
});
