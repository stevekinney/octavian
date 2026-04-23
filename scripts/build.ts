import { $ } from 'bun';
import pkg from '../package.json' with { type: 'json' };

const entrypoints = ['./src/index.ts'];
const external = Array.from(
  new Set([
    ...Object.keys(
      (pkg as Record<string, unknown> & { dependencies?: Record<string, string> }).dependencies ??
        {},
    ),
    ...Object.keys(
      (pkg as Record<string, unknown> & { peerDependencies?: Record<string, string> })
        .peerDependencies ?? {},
    ),
    ...Object.keys(
      (pkg as Record<string, unknown> & { optionalDependencies?: Record<string, string> })
        .optionalDependencies ?? {},
    ),
  ]),
);

await $`rm -rf dist`;

for (const target of ['node', 'bun'] as const) {
  await Bun.build({
    entrypoints,
    outdir: `./dist/${target}`,
    target,
    format: 'esm',
    naming: '[dir]/[name].js',
    sourcemap: 'linked',
    minify: false,
    external,
  });
}

await $`bun run tsc --declaration --emitDeclarationOnly --project tsconfig.build.json`;

console.log('Build complete.');
