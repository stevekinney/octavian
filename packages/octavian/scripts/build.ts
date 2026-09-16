import { $ } from 'bun';

await $`rm -rf dist`;

await $`bun x tsdown --config tsdown.config.ts`;

await $`bun run tsc --declaration --emitDeclarationOnly --project tsconfig.build.json`;

process.stdout.write('Build complete.\n');
