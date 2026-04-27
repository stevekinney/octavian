import * as fs from 'node:fs/promises';
import * as path from 'node:path';

type RuntimeDependencyField = 'dependencies' | 'peerDependencies' | 'optionalDependencies';

type PackageJson = Partial<
  Record<RuntimeDependencyField, Record<string, string>> & {
    name: string;
  }
>;

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
const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as PackageJson;

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

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`Validation failed: ${failure}`);
  }

  process.exit(1);
}

console.log('Artifact validation passed.');
