import { defineConfig } from 'tsdown';

// Each subpath export gets its own entry point here.
// Convention: add 'src/<name>/index.ts' to the entry array and a matching
// "./name" condition to package.json exports (types + browser/import/default).
export default defineConfig({
  entry: ['src/index.ts', 'src/sequences/index.ts'],
  outDir: 'dist/browser',
  format: 'esm',
  outExtensions: () => ({ js: '.js' }),
  sourcemap: true,
  clean: false,
  dts: false,
  minify: false,
  treeshake: true,
});
