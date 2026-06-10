import { defineConfig } from 'tsdown';

// Each subpath export gets its own entry point here.
// Convention: add 'src/<name>/index.ts' to the entry array, a matching
// "./name" condition to package.json exports (types + browser/import/default),
// and a runtime assertion in scripts/smoke-checks.mjs wired into
// scripts/smoke-consumer-check.mjs so the tarball smoke test covers it.
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/sequences/index.ts',
    'src/notation/index.ts',
    'src/pitch/index.ts',
    'src/midi/index.ts',
    'src/midi-file/index.ts',
    'src/performance-timing/index.ts',
    'src/web-audio/index.ts',
    'src/web-midi/index.ts',
  ],
  outDir: 'dist/browser',
  format: 'esm',
  outExtensions: () => ({ js: '.js' }),
  sourcemap: true,
  clean: false,
  dts: false,
  minify: false,
  treeshake: true,
});
