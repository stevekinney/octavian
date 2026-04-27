# Octavian

Type-safe music theory utilities for working with notes, intervals, chords, and scales in
TypeScript.

## Installation

```bash
npm install octavian
pnpm add octavian
yarn add octavian
bun add octavian
```

> [!NOTE] Works in Node 22+ (ESM), Bun 1.3+, and any browser bundler (Vite, webpack, Rollup). A
> single browser-safe ESM bundle is published — resolution is automatic via the `exports` map.

## Design Goals

- Immutable value objects for `Note`, `Chord`, and `Scale`
- Runtime validation at every trust boundary
- Theory-first spelling for interval, chord, and scale construction
- Sharp-preferred simplification when a pitch is derived from raw MIDI or semitone math
- 100% test coverage with full validation gates

## Quick Start

```ts
import { Chord, Note, Scale, createOctave } from 'octavian';

const cSharp = new Note('C#', createOctave(4));
const eb = cSharp.transpose('minorThird');
const cMajorSeven = new Chord(Note.create('C4'), 'maj7');
const cMajor = new Scale(Note.create('C4'), 'major');

console.log(String(eb)); // "E4"
console.log(cMajorSeven.notes.map(String)); // ["C4", "E4", "G4", "B4"]
console.log(cMajor.mode('dorian').toString()); // "D dorian"
```

## Types

All public types are importable directly from `'octavian'`:

```ts
import type {
  NoteName,
  ChordSuffix,
  ScaleType,
  Interval,
  MidiKey,
  Frequency,
  Semitones,
  Octave,
  Tuning,
} from 'octavian';
```

Key exported type names:

- **`NoteName`**: A valid note spelling such as `'C#'` or `'Bb'`.
- **`ChordSuffix`**: A canonical chord suffix such as `'majorSeventh'` or `'minorTriad'`.
- **`ScaleType`**: A canonical scale type such as `'major'` or `'melodicMinor'`.
- **`Interval`**: A canonical interval name such as `'majorThird'` or `'perfectFifth'`.
- **`MidiKey`**: A branded `number` in the range `0..127`.
- **`Frequency`**: A branded `number` in hertz.
- **`Semitones`**: A branded integer semitone distance.
- **`Octave`**: A branded octave value in the range `-1..9`. Use `createOctave(n)` to produce one.
- **`Tuning`**: A tuning reference, e.g. `{ reference: 'A4', frequency: createFrequency(440) }`.

## Core Types

### Notes

`Note` is the base value object for pitch spelling, MIDI conversion, and frequency conversion.

```ts
import { Note } from 'octavian';

const note = Note.create('Bb3');

note.note; // "Bb"
note.octave; // 3
note.midi; // 58
note.frequency; // 233.08... (always standard tuning A4 = 440 Hz)
note.chromaticIndex; // pitch class 0–11
note.enharmonics; // ["A#", "Cbb"]
```

#### Constructing notes

```ts
import { Note, createOctave } from 'octavian';

new Note('C#', createOctave(4)); // from a spelled name + branded octave
Note.create('C#4'); // from a note-name-with-octave string
Note.create({ note: 'C#', octave: createOctave(4) }); // from a structured object
Note.fromMidi(61); // from a MIDI key (sharp-preferred spelling)
Note.nearestTo(440); // nearest equal-tempered note for a frequency under standard tuning
Note.nearestTo(432, { reference: 'A4', frequency: createFrequency(432) }); // alternate tuning
```

#### Transposition and movement

```ts
const c = Note.create('C4');

c.transpose('majorThird').toString(); // "E4"  — theory-correct spelling
c.transposeBy(1).toString(); // "C#4" — semitone step, sharp-preferred
c.up().toString(); // "C5"
c.up(2).toString(); // "C6"
c.down().toString(); // "C3"
c.withOctave(5).toString(); // "C5"
c.simplify().toString(); // sharp-preferred common spelling
```

#### Comparison and distance

```ts
const a = Note.create('C4');
const b = Note.create('G4');

a.distanceTo(b); // "perfectFifth"
a.semitonesTo(b); // 7
a.equals(Note.create('C4')); // true
a.isEnharmonicTo(Note.create('B#3')); // true
Note.compare(a, b); // -1 | 0 | 1 (by MIDI key)
```

#### Frequency and tuning

`note.frequency` always returns the standard-tuning (A4 = 440 Hz) value. For alternate tunings,
use `frequencyAt` or the free function `noteToFrequency`:

```ts
import { Note, noteToFrequency, createFrequency } from 'octavian';

const a4 = Note.create('A4');
const tuning432 = { reference: 'A4', frequency: createFrequency(432) };

a4.frequency; // 440 (always standard tuning)
a4.frequencyAt(tuning432); // 432
noteToFrequency(a4, tuning432); // 432
noteToFrequency('A4'); // 440 (accepts any NoteLike, defaults to standard tuning)
```

#### Serialization

```ts
const note = Note.create('C4');
note.toString(); // "C4"
note.valueOf(); // 60 (MIDI key — makes notes sortable and comparable as numbers)
note.toJSON(); // { note: "C", octave: 4, midi: 60, frequency: 261.63 }
Note.create(note.toJSON()); // round-trips via Note.create
[...note]; // [note, octave, midi, frequency] — iterable
```

### Intervals

The library exports a full interval catalog and helpers for alias resolution.

```ts
import {
  INTERVALS,
  applyInterval,
  findCanonicalIntervalBySemitonesAndDegree,
  resolveInterval,
} from 'octavian';

resolveInterval('tone'); // "majorSecond"
resolveInterval('P5'); // "perfectFifth"
findCanonicalIntervalBySemitonesAndDegree(6, 5); // "diminishedFifth"
applyInterval(Note.create('F#4'), 'majorThird').toString(); // "A#4"
INTERVALS.majorSixth.symbol; // "M6"
INTERVALS.majorSixth.semitones; // 9
INTERVALS.majorSixth.quality; // "major"
INTERVALS.majorSixth.degree; // 6
```

### Chords

`Chord` normalizes symbols and suffix aliases into a canonical suffix while keeping immutable note
collections.

`Chord.create` and `new Chord` are equivalent for construction. To recreate a chord from serialized
data, use `Chord.fromJSON(serialized)`.

```ts
import { Chord, Note } from 'octavian';

const chord = Chord.create(Note.create('C4'), 'maj7');

chord.name; // "Cmaj7"
chord.symbol; // "maj7"
chord.suffix; // "majorSeventh"
chord.quality; // "major"
chord.root.toString(); // "C4"
chord.bass.toString(); // "C4"
chord.notes.map(String); // ["C4", "E4", "G4", "B4"]
chord.midi; // [60, 64, 67, 71]
chord.size; // 4
```

Inversions:

```ts
chord.invert().name; // "Cmaj7/E"
chord.invert(2).name; // "Cmaj7/G"
chord.inversion(1).name; // "Cmaj7/E"
chord.lowerFromTop(2).notes.map(String); // ["G3", "C4", "E4", "B4"]
chord.closeVoicing().notes.map(String); // close-position voicing
```

Chord editing stays catalog-backed:

```ts
Chord.create(Note.create('C4'), 'maj7').omit('majorSeventh').name; // "C"
Chord.create(Note.create('C4'), 'major').add('majorSeventh').name; // "Cmaj7"
Chord.create(Note.create('C4'), 'major').alter('perfectFifth', 'augmentedFifth').name; // "Caug"
Chord.create(Note.create('C4'), 'major').slash(Note.create('G3')).name; // "C/G"
```

Chord catalog helpers:

```ts
import { CHORDS, chordQualityForSuffix, createChordName, createSlashChordName } from 'octavian';

CHORDS.majorSeventh.intervals; // ["unison", "majorThird", "perfectFifth", "majorSeventh"]
chordQualityForSuffix('minorSeventh'); // "minor"
createChordName('C', 'maj7'); // "Cmaj7"
createSlashChordName('C', 'maj7', 'E'); // "Cmaj7/E"
```

### Scales

`Scale` builds theory-correct spellings from a root note and normalized scale type.

```ts
import { Scale, Note } from 'octavian';

const scale = Scale.create(Note.create('C4'), 'major');

scale.notes.map(String); // ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]
scale.root.toString(); // "C4"
scale.type; // "major"
scale.size; // 7
```

Navigation and relationships:

```ts
scale.relative('naturalMinor').toString(); // "A naturalMinor"
scale.parallel('naturalMinor').toString(); // "C naturalMinor"
scale.mode('lydian').toString(); // "F lydian"
scale.modes().map(m => m.toString()); // all 7 modes
scale.rotate(2).toString(); // rotation by 2 positions
scale.next().toString(); // next scale root (semitone up)
scale.previous().toString(); // previous scale root
```

Degrees and chords:

```ts
scale.degree(1).toString(); // "C4"
scale.degree(5).toString(); // "G4"
scale.degreeOf(Note.create('E4')); // 3
scale.chord(5, 'seventh').name; // "G7"
scale.chords().map(c => c.name); // triads for every degree
scale.seventhChords().map(c => c.name); // seventh chords for every degree
scale.triad(1).name; // "C"
```

Ascending/descending helpers return notes from a given starting pitch:

```ts
scale.ascendingFrom(Note.create('C3')).map(String);
scale.descendingFrom(Note.create('C5')).map(String);
```

Scale catalog:

```ts
import { SCALES, resolveScaleType, scaleTypeForMode, isDiatonicModeFamily } from 'octavian';

SCALES.major.intervals; // ["unison", "majorSecond", "majorThird", ...]
resolveScaleType('ionian'); // "major"
scaleTypeForMode('dorian'); // "major"
isDiatonicModeFamily('lydian'); // true
isDiatonicModeFamily('blues'); // false
```

## MIDI and Frequency

The library uses standard equal temperament with A4 = 440 Hz.

```ts
import { Note, STANDARD_TUNING, midiToFrequency, midiToNoteNameWithOctave, noteNameToMidi } from 'octavian';

STANDARD_TUNING; // { reference: 'A4', frequency: 440 }
Note.fromMidi(69).toString(); // "A4"
Note.nearestTo(440); // Note at A4
midiToFrequency(69); // 440
midiToNoteNameWithOctave(69); // { note: "A", octave: 4 }
noteNameToMidi('A', createOctave(4)); // 69
```

For alternate tunings, pass a `Tuning` object:

```ts
import { createFrequency, noteToFrequency } from 'octavian';

const tuning432 = { reference: 'A4', frequency: createFrequency(432) };

Note.nearestTo(432, tuning432).toString(); // "A4" (nearest note under that tuning)
noteToFrequency('A4', tuning432); // 432
```

## Parsing and Validation

```ts
import {
  isChordSuffix,
  isChordSymbol,
  isInterval,
  isNoteName,
  isNoteNameWithOctave,
  isScaleType,
  parseNoteName,
  parseNoteNameWithOctave,
} from 'octavian';

isNoteName('Db'); // true
isNoteNameWithOctave('Db4'); // true
isInterval('sharpEleven'); // true
isChordSuffix('minorTriad'); // true
isChordSymbol('m7b5'); // true
isScaleType('mixolydian'); // true

parseNoteName('C#'); // { note: "C#", natural: "C", accidental: "#" }
parseNoteNameWithOctave('Bb3'); // { note: "Bb", octave: 3 }
```

Invalid input throws `TypeError` (wrong shape) or `RangeError` (out-of-bounds value) from
constructors and factory methods instead of failing silently.

## Random Selection

For applications like ear-training, the library provides random-pick helpers with an injectable RNG
for reproducible tests or seeded quizzes.

```ts
import { randomNote, randomInterval, INTERVALS } from 'octavian';

// Pick a random note in a MIDI range (inclusive, sharp-preferred spelling)
const note = randomNote({ range: ['C4', Note.fromMidi(72)] });

// Pick from an explicit pool
const rootNote = randomNote({ pool: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'] });

// Pick a random interval from an explicit pool (aliases are normalized; duplicates weight the distribution)
const interval = randomInterval({ pool: ['majorThird', 'perfectFifth', 'minorSeventh'] });

// Inject a seeded RNG for reproducible results
import seedrandom from 'seedrandom'; // any [0,1) RNG
const rng = seedrandom('my-seed');
const seededNote = randomNote({ range: ['C4', 'C5'], random: rng });
```

Both functions require either `range` or `pool` — there is no default. The injected `random`
function must return values in `[0, 1)`.

## Branded Type Constructors

The library exposes constructors for every branded primitive, which are needed when calling APIs
that require branded types directly:

```ts
import {
  createOctave,
  createMidiKey,
  createFrequency,
  createSemitones,
  createChromaticIndex,
  OCTAVES,
  CHROMATIC_INDEXES,
} from 'octavian';

createOctave(4); // Octave (validated: must be -1..9)
createMidiKey(60); // MidiKey (validated: must be 0..127)
createFrequency(440); // Frequency (validated: must be > 0)
createSemitones(7); // Semitones
createChromaticIndex(0); // ChromaticIndex (0..11)
OCTAVES; // [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const
CHROMATIC_INDEXES; // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const
```

## Note-Name Utilities

Low-level helpers for working with note spellings directly:

```ts
import {
  NATURALS,
  ACCIDENTALS,
  ALL_NOTE_NAMES,
  SHARP_PREFERRED_NOTE_NAMES,
  NATURAL_CHROMATIC_INDEXES,
  ACCIDENTAL_OFFSETS,
  buildNoteName,
  simplifyNoteName,
  enharmonicsForNoteName,
  normalizeChromaticIndex,
  noteNameToChromaticIndex,
} from 'octavian';

NATURALS; // ["C", "D", "E", "F", "G", "A", "B"]
ACCIDENTALS; // ["", "#", "b", "##", "bb"]
ALL_NOTE_NAMES; // all 35 note names (all naturals × all accidentals)
SHARP_PREFERRED_NOTE_NAMES; // 12-note chromatic scale, sharp spellings

buildNoteName('C', 1); // "C#"   (natural + accidental offset)
simplifyNoteName('Bbb'); // "A"  (sharp-preferred common spelling)
enharmonicsForNoteName('C#'); // ["Db", "Bx"] (all enharmonic spellings)
normalizeChromaticIndex(13); // 1 (wraps to 0..11)
noteNameToChromaticIndex('C#'); // 1
```

## Chord and Scale Symbols

```ts
import { CHORD_SYMBOLS, resolveChordSuffix } from 'octavian';

CHORD_SYMBOLS; // ["m", "m7", "maj7", "dim", ...] — short display symbols
resolveChordSuffix('m7'); // "minorSeventh"
resolveChordSuffix('Δ7'); // "majorSeventh"
```

## Development

Run the local quality gates with Bun:

```bash
bun run typecheck
bun run lint
bun test
bun run build
bun run validate
```
