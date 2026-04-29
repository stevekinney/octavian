import { $ } from 'bun';

await $`bun run format:check`;
await $`bun run lint`;
await $`bun run typecheck`;
await $`bun run typecheck:test`;
await $`bun run test`;
await $`bun run build`;
await $`bun run package:check`;
await $`bun run validate:artifacts`;
await $`bun scripts/smoke-tarball.mjs`;
