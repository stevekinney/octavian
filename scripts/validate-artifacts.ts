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
  { description: 'process global', expression: /\bprocess\b/g },
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

// Behavioral smoke test. Resolves the real Node binary via `which node` because
// when this script runs under Bun, 'node' in PATH is Bun's own shim. We want the
// system Node (the consumer runtime that exposed the original bundle bug).
const nodeBinary = (() => {
  const which = spawnSync('which', ['node'], { encoding: 'utf8' });
  return which.status === 0 ? which.stdout.trim() : 'node';
})();

const smoke = spawnSync(nodeBinary, ['scripts/smoke-artifact.mjs'], {
  cwd: root,
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
