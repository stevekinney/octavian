# Vibratone

Vibratone is the private SvelteKit application in the Octavian monorepo. Install dependencies from
the repository root so Bun links the local `octavian` workspace package.

## Development

Run the application from the repository root:

```sh
bun install --frozen-lockfile
bun run --cwd apps/vibratone dev
```

The package opts into Octavian's `source` export condition. Imports from `octavian` resolve to
`packages/octavian/src` during local development, tests, and builds without changing the imports
used by published npm consumers.

## Validation

Run the application checks directly when iterating:

```sh
bun run --cwd apps/vibratone lint
bun run --cwd apps/vibratone typecheck
bun run --cwd apps/vibratone test
bun run --cwd apps/vibratone test:e2e
bun run --cwd apps/vibratone build
```

The root `bun run validate` command covers formatting, linting, type checking, unit tests, builds,
and Octavian's package checks. Browser tests run separately through `bun run test:e2e` and the
dedicated GitHub Actions job.
