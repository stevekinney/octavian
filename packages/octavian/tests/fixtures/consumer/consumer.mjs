import { Note, Chord, Scale, INTERVALS, CHORDS, SCALES, STANDARD_TUNING } from 'octavian';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const expectedExports = JSON.parse(readFileSync(join(__dirname, 'expected-exports.json'), 'utf8'));

const compare = (a, b) => a.localeCompare(b);

// Verify export surface
const actualExports = Object.keys(
  await import('octavian').then((m) => Object.fromEntries(Object.entries(m))),
).toSorted(compare);

const expectedSorted = [...expectedExports].toSorted(compare);
if (JSON.stringify(actualExports) !== JSON.stringify(expectedSorted)) {
  console.error('Export mismatch!');
  console.error('Expected:', expectedSorted);
  console.error('Actual:', actualExports);
  process.exit(1);
}

// README quick-start
const cSharp = Note.create('C#4');
const eb = cSharp.transpose('minorThird');
console.assert(String(eb) === 'E4', `Expected E4, got ${String(eb)}`);

const cMajorSeven = Chord.create('C4', 'maj7');
const noteStrings = cMajorSeven.notes.map(String);
console.assert(
  JSON.stringify(noteStrings) === JSON.stringify(['C4', 'E4', 'G4', 'B4']),
  `Chord notes mismatch: ${JSON.stringify(noteStrings)}`,
);

const cMajor = Scale.create('C4', 'major');
console.assert(cMajor.mode('dorian').toString() === 'D dorian', `Mode mismatch`);

console.assert(INTERVALS.majorSixth.symbol === 'M6', 'Interval symbol mismatch');
console.assert(Number(STANDARD_TUNING.frequency) === 440, 'Tuning mismatch');

console.log('Smoke test passed.');
