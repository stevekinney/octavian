import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist/browser',
  format: 'esm',
  outExtensions: () => ({ js: '.js' }),
  sourcemap: true,
  clean: false,
  dts: false,
  minify: false,
  treeshake: true,
});
