// Consumer-side smoke check. Copied by smoke-tarball.mjs into a temp consumer
// project alongside _smoke-checks.mjs and executed via bun. Imports the package
// by name so resolution goes through the consumer's node_modules (exercises the
// exports map). Assertions live in _smoke-checks.mjs — single source of truth.
import { assertSmokeChecks, assertSequencesSmokeChecks } from './_smoke-checks.mjs';

const octavian = await import('octavian');
assertSmokeChecks(octavian);

// Resolve the octavian/sequences subpath through the consumer's exports map.
const sequences = await import('octavian/sequences');
assertSequencesSmokeChecks(sequences);

process.stdout.write('tarball smoke test passed\n');
