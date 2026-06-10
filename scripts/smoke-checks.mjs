// Single source of truth for "does this build of octavian work?"
// Accepts an already-imported module object — callers do the import(),
// so this file never resolves module specifiers itself.
// Used by smoke-artifact.mjs (direct import) and smoke-tarball.mjs
// (copied into consumer dir as _smoke-checks.mjs alongside smoke-consumer-check.mjs).

export function assertSmokeChecks(octavian) {
  const expected = ['Note', 'Chord', 'Scale', 'Key', 'INTERVALS', 'CHORDS', 'SCALES'];
  for (const name of expected) {
    if (!(name in octavian)) {
      throw new Error(`missing export: ${name}`);
    }
  }
  const c4 = octavian.Note.create('C4');
  if (c4.toString() !== 'C4') throw new Error('Note.create broken');
  if (c4.midi !== 60) throw new Error('Note.midi broken');
  const cMaj7 = octavian.Chord.create('C4', 'maj7');
  if (cMaj7.notes.length !== 4) throw new Error('Chord.create broken');
  const cMajor = octavian.Scale.create('C4', 'major');
  if (cMajor.notes.length !== 7) throw new Error('Scale.create broken');
  const key = octavian.Key.create('C', 'major');
  if (key.toString() !== 'C major') throw new Error('Key.create broken');
  if (typeof octavian.INTERVALS.majorThird?.semitones !== 'number') {
    throw new Error('INTERVALS catalog broken');
  }
}

// Subpath-export smoke checks. Each subpath (e.g. octavian/sequences) is a
// separate entry in the package.json "exports" map and resolves to its own
// browser bundle. When adding a new subpath, import it in
// smoke-consumer-check.mjs and add an assertion here.
//
// The tarball smoke test runs under Bun (a non-browser runtime). For pure
// subpaths, exercise real behavior as below. For browser-only ADAPTER subpaths
// (Web Audio, Web MIDI), the runtime globals (AudioContext,
// navigator.requestMIDIAccess) do not exist here — so:
//   1. The adapter module MUST NOT touch browser globals at import time, or the
//      bare `await import('octavian/<adapter>')` will throw in this test.
//   2. The assertion must be EXISTENCE-ONLY (`typeof X === 'function'`). Never
//      instantiate or call an adapter that needs a browser global.
export function assertSequencesSmokeChecks(sequences) {
  if (typeof sequences.Sequence?.create !== 'function') {
    throw new Error('octavian/sequences: Sequence.create missing');
  }
  if (typeof sequences.musicalTime !== 'function') {
    throw new Error('octavian/sequences: musicalTime missing');
  }
  const seq = sequences.Sequence.create(
    [{ type: 'rest', start: sequences.musicalTime(0, 1), duration: sequences.musicalTime(1, 4) }],
    { tempo: 120 },
  );
  if (seq.events.length !== 1) throw new Error('octavian/sequences: Sequence.create broken');
}
