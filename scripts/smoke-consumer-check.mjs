// Consumer-side smoke check. Imported by smoke-tarball.mjs into a temp consumer
// project and executed via bun. Imports the package by name so resolution goes
// through the consumer's node_modules (exercises the exports map).
// Keep assertions in sync with scripts/smoke-checks.mjs.
const octavian = await import('octavian');

const expected = ['Note', 'Chord', 'Scale', 'Key', 'INTERVALS', 'CHORDS', 'SCALES'];
for (const name of expected) {
  if (!(name in octavian)) throw new Error('missing export: ' + name);
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
if (typeof octavian.INTERVALS.majorThird?.semitones !== 'number')
  throw new Error('INTERVALS catalog broken');

process.stdout.write('tarball smoke test passed\n');
