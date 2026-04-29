// Single source of truth for "does this build of octavian work?"
// Accepts an already-imported module object — callers do the import(),
// so this file never resolves module specifiers itself.
// Keep in sync with the inlined assertions in smoke-tarball.mjs.

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
