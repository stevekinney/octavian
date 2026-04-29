// Validates the package through exports-map resolution: packs a tarball, installs
// it in a temp consumer project, and runs scripts/smoke-consumer-check.mjs via bun.
// The consumer check is a separate file (not an inline string) so it can be linted
// and formatted like any other source file.
// Consumer-side bun resolves imports through the consumer's node_modules, not the
// repo's module graph — the key invariant that makes this test meaningful.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

const packDir = mkdtempSync(join(tmpdir(), 'octavian-pack-'));
let installDir;
let exitCode = 0;

try {
  // Use bun pm pack --ignore-scripts so the prepack hook (which re-builds) does
  // not run. The dist/ from the preceding build step is what we want to test.
  // --quiet limits stdout to just the tarball path (plus a possible env-file
  // timing line from Bun). Extract the absolute path line from the output.
  const pack = spawnSync(
    'bun',
    ['pm', 'pack', '--ignore-scripts', '--quiet', '--destination', packDir],
    { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' },
  );
  if (pack.status !== 0) {
    process.stderr.write(`bun pm pack failed:\nstdout: ${pack.stdout}\nstderr: ${pack.stderr}\n`);
    exitCode = 1;
  } else {
    // --quiet output may include a "[Xms] .env" timing line; find the line that
    // looks like an absolute path to the tarball.
    const packedOutput = pack.stdout
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('/') || l.endsWith('.tgz'));
    if (!packedOutput) {
      process.stderr.write(
        `bun pm pack produced no path in output.\nstdout: ${pack.stdout}\nstderr: ${pack.stderr}\n`,
      );
      exitCode = 1;
    } else {
      const tarballPath = isAbsolute(packedOutput) ? packedOutput : resolve(packDir, packedOutput);
      if (!existsSync(tarballPath)) {
        process.stderr.write(`tarball not found at ${tarballPath}\n`);
        exitCode = 1;
      } else {
        installDir = mkdtempSync(join(tmpdir(), 'octavian-consumer-'));
        writeFileSync(
          join(installDir, 'package.json'),
          JSON.stringify(
            {
              name: 'octavian-smoke-consumer',
              type: 'module',
              dependencies: { [pkg.name]: `file:${tarballPath}` },
            },
            null,
            2,
          ),
        );
        const install = spawnSync('bun', ['install'], {
          cwd: installDir,
          stdio: 'pipe',
          encoding: 'utf8',
        });
        if (install.status !== 0) {
          process.stderr.write(`bun install failed:\n${install.stderr}\n`);
          exitCode = 1;
        } else {
          // Copy the consumer check script into the install dir so bun resolves
          // 'octavian' through the consumer's node_modules, not the repo's.
          const checkFile = join(installDir, '_smoke-consumer-check.mjs');
          copyFileSync(join(here, 'smoke-consumer-check.mjs'), checkFile);
          const run = spawnSync('bun', [checkFile], {
            cwd: installDir,
            stdio: 'inherit',
          });
          exitCode = run.status ?? 1;
        }
      }
    }
  }
} finally {
  try {
    rmSync(packDir, { recursive: true, force: true });
  } catch {}
  try {
    if (installDir) rmSync(installDir, { recursive: true, force: true });
  } catch {}
}

process.exitCode = exitCode;
