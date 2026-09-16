# Octavian

This repository is a Bun workspace orchestrated by Turborepo. The published `octavian` music theory
library lives in [`packages/octavian`](./packages/octavian).

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
