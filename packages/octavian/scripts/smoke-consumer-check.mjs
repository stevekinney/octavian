// Consumer-side smoke check. Copied by smoke-tarball.mjs into a temp consumer
// project alongside _smoke-checks.mjs and executed via bun. Imports the package
// by name so resolution goes through the consumer's node_modules (exercises the
// exports map). Assertions live in _smoke-checks.mjs — single source of truth.
import {
  assertSmokeChecks,
  assertSequencesSmokeChecks,
  assertNotationSmokeChecks,
  assertPitchSmokeChecks,
  assertMidiSmokeChecks,
  assertMidiFileSmokeChecks,
  assertPerfTimingSmokeChecks,
  assertWebAudioSmokeChecks,
  assertWebMidiSmokeChecks,
} from './_smoke-checks.mjs';

const octavian = await import('octavian');
assertSmokeChecks(octavian);

// Resolve each subpath through the consumer's exports map.
const sequences = await import('octavian/sequences');
assertSequencesSmokeChecks(sequences);

const notation = await import('octavian/notation');
assertNotationSmokeChecks(notation);

const pitch = await import('octavian/pitch');
assertPitchSmokeChecks(pitch);

const midi = await import('octavian/midi');
assertMidiSmokeChecks(midi);

const midiFile = await import('octavian/midi-file');
assertMidiFileSmokeChecks(midiFile, sequences);

const perfTiming = await import('octavian/perf-timing');
assertPerfTimingSmokeChecks(perfTiming);

// Browser-only adapters: importing under Bun must not throw (proves no
// import-time browser globals), and the factory must be present.
const webAudio = await import('octavian/web-audio');
assertWebAudioSmokeChecks(webAudio);

const webMidi = await import('octavian/web-midi');
assertWebMidiSmokeChecks(webMidi);

process.stdout.write('tarball smoke test passed\n');
