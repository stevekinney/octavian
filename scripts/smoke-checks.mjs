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

export function assertNotationSmokeChecks(notation) {
  if (typeof notation.staffPositionFor !== 'function') {
    throw new Error('octavian/notation: staffPositionFor missing');
  }
  if (typeof notation.accidentalForDisplay !== 'function') {
    throw new Error('octavian/notation: accidentalForDisplay missing');
  }
  // Ground truth: middle C (C4) sits on the first ledger line below the treble staff.
  const position = notation.staffPositionFor('C4', 'treble');
  if (position.ledgerLines !== 1) {
    throw new Error('octavian/notation: staffPositionFor(C4, treble) ledgerLines broken');
  }
}

export function assertPitchSmokeChecks(pitch) {
  if (typeof pitch.evaluatePitchEstimate !== 'function') {
    throw new Error('octavian/pitch: evaluatePitchEstimate missing');
  }
  // Ground truth: a 440 Hz estimate against A4 is exactly on pitch (0 cents).
  const evaluation = pitch.evaluatePitchEstimate({ frequency: 440 }, 'A4');
  if (Math.abs(evaluation.centsError) > 0.001) {
    throw new Error('octavian/pitch: evaluatePitchEstimate centsError broken');
  }
}

export function assertMidiSmokeChecks(midi) {
  if (typeof midi.parseMidiMessage !== 'function') {
    throw new Error('octavian/midi: parseMidiMessage missing');
  }
  // Ground truth: 0x90 status, note 60, velocity 100 is a note-on for MIDI key 60.
  const message = midi.parseMidiMessage([0x90, 60, 100]);
  if (message.type !== 'noteOn' || message.note !== 60) {
    throw new Error('octavian/midi: parseMidiMessage broken');
  }
}

export function assertMidiFileSmokeChecks(midiFile, sequences) {
  if (typeof midiFile.sequenceToMidiFile !== 'function') {
    throw new Error('octavian/midi-file: sequenceToMidiFile missing');
  }
  // Ground truth: a serialized SMF begins with the ASCII 'MThd' header chunk.
  const seq = sequences.Sequence.create(
    [{ type: 'rest', start: sequences.musicalTime(0, 1), duration: sequences.musicalTime(1, 4) }],
    { tempo: 120 },
  );
  const bytes = midiFile.sequenceToMidiFile(seq);
  if (bytes[0] !== 0x4d || bytes[1] !== 0x54 || bytes[2] !== 0x68 || bytes[3] !== 0x64) {
    throw new Error('octavian/midi-file: sequenceToMidiFile MThd header broken');
  }
}

export function assertPerfTimingSmokeChecks(perfTiming) {
  if (typeof perfTiming.estimateTempoFromOnsets !== 'function') {
    throw new Error('octavian/perf-timing: estimateTempoFromOnsets missing');
  }
  if (typeof perfTiming.classifyTimingError !== 'function') {
    throw new Error('octavian/perf-timing: classifyTimingError missing');
  }
  // Ground truth: onsets a half-second apart imply 120 BPM.
  const estimate = perfTiming.estimateTempoFromOnsets([0, 0.5, 1.0, 1.5]);
  if (!estimate || Math.abs(estimate.bpm - 120) > 0.001) {
    throw new Error('octavian/perf-timing: estimateTempoFromOnsets broken');
  }
}

// Browser-only ADAPTER subpath. EXISTENCE-ONLY: the renderer needs a real
// AudioContext (absent under Bun), so we only assert the factory exists and
// that bare-importing the module did not throw on a browser global.
export function assertWebAudioSmokeChecks(webAudio) {
  if (typeof webAudio.createWebAudioRenderer !== 'function') {
    throw new Error('octavian/web-audio: createWebAudioRenderer missing');
  }
}

// Browser-only ADAPTER subpath. EXISTENCE-ONLY: the controller needs a real
// MIDIAccess (absent under Bun), so we only assert the factory exists and
// that bare-importing the module did not throw on a browser global.
export function assertWebMidiSmokeChecks(webMidi) {
  if (typeof webMidi.createWebMidiInput !== 'function') {
    throw new Error('octavian/web-midi: createWebMidiInput missing');
  }
}
