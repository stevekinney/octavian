// Validates dist/browser/index.js (the built artifact path, NOT the exports map).
// Run with Node to test the consumer runtime: node scripts/smoke-artifact.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { assertSmokeChecks } from './smoke-checks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const target = pathToFileURL(resolve(here, '..', 'dist/browser/index.js')).href;

try {
  const octavian = await import(target);
  assertSmokeChecks(octavian);
  process.stdout.write('artifact smoke test passed\n');
} catch (err) {
  process.stderr.write(`artifact smoke test failed: ${err.stack ?? `${err.name}: ${err.message}`}\n`);
  process.exit(1);
}
