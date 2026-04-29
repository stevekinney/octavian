import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

type RuntimeDependencyField = 'dependencies' | 'peerDependencies' | 'optionalDependencies';

type PackageJson = Partial<Record<RuntimeDependencyField, Record<string, string>>>;

function isPackageJson(value: unknown): value is PackageJson {
  return typeof value === 'object' && value !== null;
}

type PatternCheck = {
  description: string;
  expression: RegExp;
};

const root = path.resolve(import.meta.dirname, '..');
const browserArtifactPath = path.join(root, 'dist/browser/index.js');
const declarationsPath = path.join(root, 'dist/index.d.ts');
const packageJsonPath = path.join(root, 'package.json');

const browserArtifact = await fs.readFile(browserArtifactPath, 'utf8');
const declarationsArtifact = await fs.readFile(declarationsPath, 'utf8');
const rawPackageJson: unknown = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
if (!isPackageJson(rawPackageJson)) {
  throw new TypeError('package.json is not a valid object');
}
const packageJson: PackageJson = rawPackageJson;

const failures: string[] = [];

const browserGlobalPatterns: PatternCheck[] = [
  // Match process.x and process[x] but not words like "post-process" in comments.
  { description: 'process global', expression: /\bprocess[.[]/g },
  { description: 'Buffer global', expression: /\bBuffer\b/g },
  { description: '__dirname', expression: /__dirname/g },
  { description: '__filename', expression: /__filename/g },
  { description: 'Bun global', expression: /\bBun\b/g },
  { description: 'node: imports', expression: /node:/g },
  { description: 'require() calls', expression: /require\(/g },
];

const bareSpecifierPatterns: PatternCheck[] = [
  { description: 'bare named imports or re-exports', expression: /\bfrom\s+['"][^./]/g },
  { description: 'bare dynamic imports', expression: /\bimport\(['"][^./]/g },
  { description: 'bare side-effect imports', expression: /^import\s+['"][^./]/gm },
  {
    description: 'bare re-exports',
    expression: /^export\s+.*\s+from\s+['"][^./]/gm,
  },
  {
    description: 'bare type-only imports',
    expression: /import\s+type\s+.*\s+from\s+['"][^./]/g,
  },
  {
    description: 'bare type-only re-exports',
    expression: /export\s+type\s+.*\s+from\s+['"][^./]/g,
  },
  {
    description: 'triple-slash types reference directives',
    expression: /\/\/\/\s*<reference\s+types=/g,
  },
  {
    description: 'triple-slash path reference directives',
    expression: /\/\/\/\s*<reference\s+path=/g,
  },
];

function countMatches(source: string, expression: RegExp): number {
  return Array.from(source.matchAll(expression)).length;
}

function assertZeroMatches(artifactLabel: string, source: string, checks: PatternCheck[]): void {
  for (const check of checks) {
    const matches = countMatches(source, check.expression);
    if (matches > 0) {
      failures.push(
        `${artifactLabel}: found ${matches} match${matches === 1 ? '' : 'es'} for ${check.description}.`,
      );
    }
  }
}

function assertEmptyRuntimeDependencies(): void {
  const runtimeDependencyFields: RuntimeDependencyField[] = [
    'dependencies',
    'peerDependencies',
    'optionalDependencies',
  ];

  for (const field of runtimeDependencyFields) {
    const values = packageJson[field];
    if (values && Object.keys(values).length > 0) {
      failures.push(`${field} must be absent or empty in package.json.`);
    }
  }
}

assertZeroMatches(
  'dist/browser/index.js browser-global check',
  browserArtifact,
  browserGlobalPatterns,
);
assertEmptyRuntimeDependencies();
assertZeroMatches(
  'dist/browser/index.js bare-specifier check',
  browserArtifact,
  bareSpecifierPatterns,
);
assertZeroMatches(
  'dist/index.d.ts bare-specifier check',
  declarationsArtifact,
  bareSpecifierPatterns,
);

// Behavioral smoke test. If this script runs under Bun, `node` in PATH may be
// Bun's shim rather than a real Node binary. Prefer an explicit override and
// otherwise probe candidates so the smoke test runs under Node.
function isBunBinary(command: string, env?: NodeJS.ProcessEnv): boolean {
  const probe = spawnSync(command, ['-p', 'Boolean(process.versions?.bun)'], {
    encoding: 'utf8',
    env,
    stdio: 'pipe',
  });

  if (probe.error || probe.status !== 0) {
    return false;
  }

  return probe.stdout.trim() === 'true';
}

function resolveNodeBinary(): { command: string; env?: NodeJS.ProcessEnv } {
  const override = process.env['OCTAVIAN_NODE_BINARY']?.trim();
  if (override) {
    return { command: override, env: process.env };
  }

  if (!isBunBinary('node', process.env)) {
    return { command: 'node', env: process.env };
  }

  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path');
  if (!pathKey) {
    return { command: 'node', env: process.env };
  }

  const bunBinDir = path.dirname(process.execPath);
  const originalPath = process.env[pathKey];
  if (!originalPath) {
    return { command: 'node', env: process.env };
  }

  const filteredPath = originalPath
    .split(path.delimiter)
    .filter((entry) => entry && path.resolve(entry) !== path.resolve(bunBinDir))
    .join(path.delimiter);
  const envWithoutBun = {
    ...process.env,
    [pathKey]: filteredPath,
  };

  if (!isBunBinary('node', envWithoutBun)) {
    return { command: 'node', env: envWithoutBun };
  }

  return { command: 'node', env: process.env };
}

const { command: nodeBinary, env: nodeBinaryEnv } = resolveNodeBinary();
const smoke = spawnSync(nodeBinary, ['scripts/smoke-artifact.mjs'], {
  cwd: root,
  env: nodeBinaryEnv,
  stdio: 'pipe',
});
const smokeError = smoke.error as NodeJS.ErrnoException | undefined;
if (smokeError?.code === 'ENOENT') {
  failures.push(`'node' not found on PATH; cannot run artifact smoke test.`);
} else if (smoke.status !== 0) {
  failures.push(`artifact smoke test failed (exit ${smoke.status}):\n${smoke.stderr.toString()}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`Validation failed: ${failure}\n`);
  }

  process.exit(1);
}

process.stdout.write(`Artifact validation passed. Bundle size: ${browserArtifact.length} bytes\n`);
