# Octavian

This repository is a Bun workspace orchestrated by Turborepo. It contains the published `octavian`
music theory library in [`packages/octavian`](./packages/octavian) and the private Vibratone
application in [`apps/vibratone`](./apps/vibratone).

## Development

Install the workspace and run the full repository gate from the root:

```bash
bun install --frozen-lockfile
bun run validate
```

Turbo can target the library directly when iterating:

```bash
bunx turbo run test --filter=octavian
bunx turbo run build package:check --filter=octavian
```

Vibratone depends on `octavian` through `workspace:*`. Its Vite and TypeScript configuration opt in
to Octavian's `source` export condition, so local development and builds read the library's
TypeScript source directly. Regular npm consumers do not enable that condition and continue to
receive the compiled JavaScript and declaration files from `dist`.

The complete package API and usage documentation is in
[`packages/octavian/README.md`](./packages/octavian/README.md).

## Releasing

Releases are tag-driven. Update `packages/octavian/package.json`, commit the release, and push a
matching `vX.Y.Z` tag. The `release.yaml` workflow validates the workspace, builds and inspects the
package, runs the tarball consumer smoke test, and publishes from `packages/octavian` through npm
trusted publishing with provenance.

The npm trusted publisher must target `stevekinney/octavian` and the workflow filename
`release.yaml`. Publishing is tokenless; do not add `NPM_TOKEN` or `NODE_AUTH_TOKEN` to the publish
job.
