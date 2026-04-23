# Project Name

## Prerequisites

- [Bun](https://bun.sh) installed on your machine.

## Installation

Create a new project based on this template:

```bash
# Basic installation
bun create github.com/stevekinney/bun-template $PROJECT_DIRECTORY

# Skip installing dependencies (useful for CI or offline work)
bun create github.com/stevekinney/bun-template $PROJECT_DIRECTORY --no-install
```

The `--no-install` flag is helpful when:

- Working in offline environments
- Using CI pipelines with cached dependencies
- You plan to modify dependencies before installation

## Core Tools

- Bun: runtime, bundler, test runner, and package manager
- TypeScript: strict type checking
- Oxlint: fast Rust-based linter
- Prettier: formatting
- Lefthook: Git hooks

## Development

Start the development server:

```bash
bun run dev
```

### Git Hooks (Lefthook)

Lefthook is installed via the `prepare` script on `bun install`. Hook implementations live in `scripts/hooks/` and are configured in `lefthook.yml`.

- `pre-commit`: formats staged files with Prettier, runs oxlint --fix on staged files, checks that `bun.lock` is staged when `package.json` changes. Fast by design — typecheck and tests are intentionally deferred to pre-push.
- `pre-push`: runs `bun run validate` (format check, lint, typecheck, tests, build, and package validation). This is the full gate before code leaves your machine.
- `post-checkout`: installs deps when `package.json` + `bun.lock` changed; surfaces config changes.
- `post-merge`: installs/cleans when dependencies or config changed; shows merge stats.

Use `--no-verify` to bypass hooks (not recommended; CI will catch you anyway).

### Running Tests

This template uses Bun's built-in test runner with a preloaded setup file at `test/setup.ts` that resets mocks and system time after each test.

```bash
bun test              # run all tests
bun test --watch      # watch mode
bun test --coverage   # coverage report
```

Coverage thresholds are configured in `bunfig.toml` under `[test]`. The default is 100% for `src/`.

For mocking, clock control, and module mocking see the [bun:test docs](https://bun.sh/docs/test/mocks).

### Continuous Integration

A CI workflow at `.github/workflows/ci.yaml` runs `bun run validate` on every push and pull request against Node 22 (LTS) and Node 24 (latest). This includes linting, typechecking, tests, build, and package validation (`publint` + `@arethetypeswrong/cli`).

### Understanding `bun run` vs `bunx`

- **bun run**: Executes scripts defined in `package.json` or runs local TypeScript/JavaScript files directly.
- **bun x**: Executes binaries from installed packages. For packages already in `devDependencies`, prefer `bun run <script>` or calling the binary directly rather than `bunx`, which can pull a remote version.

## Project Structure

- `src/` — Source code
- `test/` — Test setup (`test/setup.ts` is preloaded by bun:test)
- `scripts/hooks/` — Git hook implementations (TypeScript + Bun)
- `scripts/setup/` — One-time `bun create` setup scripts (self-remove after first install)
- `lefthook.yml` — Git hook configuration

## Library Output

When built, the package emits two ESM bundles:

- `dist/node/index.js` — Node-compatible build (`Bun.build target: 'node'`)
- `dist/bun/index.js` — Bun-optimized build (`Bun.build target: 'bun'`)
- `dist/index.d.ts` — Shared TypeScript declarations

The `package.json` `exports` map routes Bun consumers to the Bun build and Node/bundler consumers to the Node build automatically.

Published `src/` code must not use Bun-only runtime APIs (`Bun.file`, `Bun.serve`, etc.) — those belong in `scripts/` and tests only.

## Publishing

Publishing is opt-in. When you're ready to publish to npm:

1. Set `publishConfig` in your `package.json` as needed:
   ```json
   "publishConfig": { "access": "public", "provenance": true }
   ```
2. Tag the release: `git tag vX.Y.Z && git push --tags`
3. The `release.yaml` workflow triggers, verifies the tag matches `package.json`, builds, validates the package exports, and publishes with npm provenance (requires `id-token: write` permission, already set in the workflow).

## Customization

### TypeScript Configuration

The base `tsconfig.json` targets ESNext with strict settings tuned for a Bun library. To add a frontend app layer:

- Extend `tsconfig.json` in a new `tsconfig.frontend.json`
- Add `"lib": ["ESNext","DOM","DOM.Iterable"]` and `"jsx": "react-jsx"` (or your framework equivalent)

### Template Setup (bun-create)

When using `bun create` with this template, a postinstall sequence runs once to bootstrap the project:

- Sets `package.json:name` from the folder name
- Copies `.env.example` to `.env` (or appends missing keys)
- Writes `OPEN_AI_API_KEY`, `ANTHROPIC_AI_API_KEY`, and `GEMINI_AI_API_KEY` from your shell into `.env` if the values are currently empty or placeholder
- Runs `bun run prepare` to install Lefthook hooks
- Removes `scripts/setup/` and the `bun-create` entry from `package.json`

These steps are idempotent — safe to re-run if something fails partway through.
