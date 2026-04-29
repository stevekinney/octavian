// Validates the package through exports-map resolution: packs a tarball, installs
// it in a temp consumer project, and imports through the package name.
// Assertions are inlined (not imported from smoke-checks.mjs) so the consumer
// process resolves only through its own node_modules, not the repo's module graph.
// Keep assertions in sync with scripts/smoke-checks.mjs.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

// The consumer-side smoke check runs via Bun (not Node) because when this script
// runs inside `bun run`, Bun intercepts any execution of the 'node' binary —
// even at absolute paths — via its Node compatibility shim. Using Bun directly
// for the consumer check is valid: Bun resolves the installed package through
// the consumer's node_modules just as Node would.

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
          const checkScript = `
            import('${pkg.name}').then((octavian) => {
              const expected = ['Note', 'Chord', 'Scale', 'Key', 'INTERVALS', 'CHORDS', 'SCALES'];
              for (const name of expected) {
                if (!(name in octavian)) throw new Error('missing export: ' + name);
              }
              const c4 = octavian.Note.create('C4');
              if (c4.toString() !== 'C4') throw new Error('Note.create broken');
              if (c4.midi !== 60) throw new Error('Note.midi broken');
              const cMaj7 = octavian.Chord.create('C4', 'maj7');
              if (cMaj7.notes.length !== 4) throw new Error('Chord.create broken');
              const cMajor = octavian.Scale.create('C4', 'major');
              if (cMajor.notes.length !== 7) throw new Error('Scale.create broken');
              const key = octavian.Key.create('C', 'major');
              if (key.toString() !== 'C major') throw new Error('Key.create broken');
              if (typeof octavian.INTERVALS.majorThird?.semitones !== 'number')
                throw new Error('INTERVALS catalog broken');
              process.stdout.write('tarball smoke test passed\\n');
            }).catch((err) => {
              process.stderr.write('tarball smoke test failed: ' + (err.stack ?? err.message) + '\\n');
              process.exit(1);
            });
          `;
          // Write the check script to a temp file so bun can execute it directly.
          const checkFile = join(installDir, '_smoke-check.mjs');
          writeFileSync(checkFile, checkScript);
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
