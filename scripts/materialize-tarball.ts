import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as tar from 'tar';

const tarball = process.argv[2];

if (!tarball) {
  throw new Error('Usage: materialize-tarball.ts <tarball-path>');
}

const targets = [
  path.resolve(import.meta.dirname, '../examples/node-consumer/node_modules/octavian'),
  path.resolve(import.meta.dirname, '../examples/web-audio/node_modules/octavian'),
];

for (const target of targets) {
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
  await tar.extract({ file: tarball, cwd: target, strip: 1 });
}

console.log('Materialized octavian into fixture node_modules.');
