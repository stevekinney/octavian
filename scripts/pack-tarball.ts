import { $ } from 'bun';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tarballDirectory = path.join(root, 'examples/.tarball');

await fs.rm(tarballDirectory, { recursive: true, force: true });
await fs.mkdir(tarballDirectory, { recursive: true });

await $`bun run build`;

const result =
  (await $`npm pack --json --ignore-scripts --pack-destination=examples/.tarball`.json()) as Array<{
    filename?: string;
  }>;
const tarballFile = result[0]?.filename;

if (!tarballFile) {
  throw new Error('npm pack produced no output');
}

const tarballPath = path.join(tarballDirectory, tarballFile);

await $`bun run scripts/materialize-tarball.ts ${tarballPath}`;

console.log(`Packed and materialized: ${tarballFile}`);
