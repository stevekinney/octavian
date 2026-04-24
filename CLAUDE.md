# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development

```bash
bun run dev               # Start development with watch mode
bun run build             # Build for production (outputs to dist/)
bun ./dist/bun/index.js   # Run Bun-optimized build
node ./dist/node/index.js # Run Node-compatible build
```

### Testing

```bash
bun test                  # Run all tests
bun test src/utils        # Run tests in specific directory
bun test logger           # Run tests matching pattern
bun test --watch          # Watch mode
bun test --coverage       # Generate coverage report
```

### Code Quality

```bash
bun run lint             # Check linting errors
bun run lint:fix         # Auto-fix linting errors
bun run typecheck        # TypeScript type checking (src + scripts)
bun run typecheck:test   # TypeScript type checking (test files)
bun run format           # Format all files with Prettier
bun run format:check     # Check formatting without changes
bun run check            # Fast local sanity: format:check + lint + typecheck
bun run validate         # Full gate: format:check + lint + typecheck + typecheck:test + test + build + package:check
```

### Utilities

```bash
bun run clean            # Clean build artifacts (dist/, coverage/, caches)
bun run package:check    # Run publint + @arethetypeswrong/cli on packed tarball
```

## Architecture Overview

### Core Design Principles

1. **Environment-First Configuration**: All configuration starts with environment variables validated through Zod schemas in `src/environment.ts`. The `environment` object is the single source of truth.

2. **Lean Surface Area**: This template intentionally avoids framework-specific scaffolding (custom error classes, logger wrappers, etc.). Add only what you need for your project.

3. **Runtime-Neutral Published Code**: `src/` must not use Bun-only runtime APIs (`Bun.file`, `Bun.env`, `Bun.serve`, etc.). Those APIs are fine in `scripts/` and test files, but must not appear in published library output.

### Key Notes

- **ESM + TypeScript**: Source files are TypeScript modules; build output targets both Node and Bun.
- **Import paths**: Use standard TS/ESM imports; no `@/*` path alias (it leaks into `.d.ts` files).
- **Library output**: Dual-emit — `dist/node/` for Node consumers, `dist/bun/` for Bun consumers. The `exports` map routes consumers automatically.

### Library Packaging

The build produces:

- `dist/node/index.js` — ESM bundle, `Bun.build target: 'node'`, all deps external
- `dist/bun/index.js` — ESM bundle, `Bun.build target: 'bun'`, all deps external
- `dist/index.d.ts` — TypeScript declarations (shared)

The `exports` map in `package.json`:

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "bun": "./dist/bun/index.js",
    "import": "./dist/node/index.js",
    "default": "./dist/node/index.js"
  },
  "./package.json": "./package.json"
}
```

Package validation runs as part of `validate`: `publint` checks the exports map structure and `@arethetypeswrong/cli` checks type resolution across resolution modes.

### Git Hooks Architecture

Hooks are configured in `lefthook.yml` and implemented as Bun TypeScript files under `scripts/hooks/`:

- **pre-commit** (`lefthook.yml` inline, piped/sequential): formats staged files with Prettier, runs oxlint --fix on staged files, checks `bun.lock` is staged when `package.json` changes. Fast by design.
- **pre-push** (`lefthook.yml`): runs full `bun run validate`.
- **post-checkout** (`scripts/hooks/post-checkout.ts`): installs deps when `package.json`+`bun.lock` change; surfaces config changes.
- **post-merge** (`scripts/hooks/post-merge.ts`): installs/cleans when dependencies or config changed; shows merge stats.

They use `chalk` for color, `change-case` for headings, and Bun's `$` and `Bun.write` for shell/IO.

### Types

There is no shared `src/types.ts` in this template. Add shared or domain-specific types near their modules as needed.

## Development Patterns

### Adding New Features

1. **Environment variables**: Add to `.env.example` first, then update the schema in `src/environment.ts`.
2. **Types**: Domain-specific types live near their modules.

### Testing Approach

- Tests use Bun's built-in test runner with `describe`, `it`, `expect`.
- Test files are colocated with sources using the `.test.ts` suffix.
- `test/setup.ts` is preloaded by `bunfig.toml` — it resets mocks and system time in `afterEach`. All tests get this automatically.
- Oxlint rules are relaxed for test files. You can use `any`, non-null assertions, and other patterns normally flagged.
- A separate `tsconfig.test.json` provides relaxed TypeScript settings for tests (checked by `bun run typecheck:test`).
- Coverage threshold is 100% for `src/`. Run `bun test --coverage` to see the report.

### Import Organization

Keep imports in this order:

1. Bun built-ins (e.g., `import { file, write } from 'bun'`)
2. Node built-ins (e.g., `import { readFile } from 'node:fs'`)
3. External packages (e.g., `import { z } from 'zod'`)
4. Relative imports (e.g., `./local-module`)

No path alias (`@/*`) — use relative imports everywhere.

## Bun-Specific Considerations

- Always use `bun` commands, not `npm` or `yarn`.
- The lockfile in this repo is `bun.lock`.
- Bun provides native TypeScript execution without precompilation.
- For one-off package execution, use `bun x` for packages already in `devDependencies` rather than `bunx`, which can pull remote versions.

### Prefer Bun Built-ins Over Node

When possible, use Bun's native APIs in `scripts/` and tests. Do not use them in `src/` — published code must be Node-compatible.

| Task          | Use (Bun)                                | Avoid (Node)                     |
| ------------- | ---------------------------------------- | -------------------------------- |
| Read file     | `Bun.file(path).text()`                  | `fs.readFileSync(path, 'utf-8')` |
| Write file    | `Bun.write(path, data)`                  | `fs.writeFileSync(path, data)`   |
| HTTP server   | `Bun.serve()`                            | `http.createServer()` or Express |
| Hashing       | `Bun.hash()` or `new Bun.CryptoHasher()` | `crypto.createHash()`            |
| Spawn process | `Bun.spawn()` or `Bun.$`                 | `child_process.spawn()`          |
| Sleep         | `Bun.sleep(ms)`                          | `setTimeout` with promisify      |
| Environment   | `Bun.env.VAR`                            | `process.env.VAR`                |
| Glob          | `Bun.Glob`                               | `glob` package                   |

When a Bun equivalent doesn't exist or Node's API is more appropriate, use the `node:` prefix for clarity (e.g., `import { join } from 'node:path'`).

### Configuration Notes

- **bunfig.toml**: Configures the `.md` text loader, forces Bun runtime for scripts, and sets up `bun test` with preload, coverage, and 100% thresholds.
- **TypeScript**: Uses Bun types; Node type libs are not included by default.
- **Oxlint**: Rust-based linter with built-in TypeScript, promise, unicorn, and import plugins. Type-aware rules enabled via `--type-aware --tsconfig ./tsconfig.json`. Test files have relaxed rules.
- **Testing**: Run tests in parallel via `bun test --parallel` (the `"test"` script includes this flag).

## Error Taxonomy

- `TypeError` — shape/type validation failures (unsupported note names, unrecognized chord suffixes, mismatched serialized data)
- `RangeError` — numeric bounds violations (MIDI out of 0..127, octave out of -1..9, frequency ≤ 0)
- Plain `Error` — not used (programmer configuration errors were removed in the factory-cycle cleanup)
