import { $ } from 'bun';

const entrypoints = ['./src/index.ts'];

await $`rm -rf dist`;

for (const target of ['browser'] as const) {
  await Bun.build({
    entrypoints,
    outdir: `./dist/${target}`,
    target,
    format: 'esm',
    naming: '[dir]/[name].js',
    sourcemap: 'linked',
    minify: false,
    external: [],
  });
}

await $`bun run tsc --declaration --emitDeclarationOnly --project tsconfig.build.json`;

console.log('Build complete.');
