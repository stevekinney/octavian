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

> [!NOTE] Runtime requirements Node 22+ (ESM) or Bun 1.3+. Dual Node/Bun resolution is automatic via
> the `exports` map—no configuration needed on your end.

## Design Goals

- Immutable value objects for `Note`, `Chord`, and `Scale`
- Runtime validation at every trust boundary
- Theory-first spelling for interval, chord, and scale construction
- Sharp-preferred simplification when a pitch is derived from raw MIDI or semitone math
- 100% test coverage with full validation gates

## Quick Start

```ts
import { Chord, Note, Scale } from 'octavian';

const cSharp = new Note('C#', 4);
const eb = cSharp.transpose('minorThird');
const cMajorSeven = Chord.create('C4', 'maj7');
const cMajor = Scale.create('C4', 'major');

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
- **`Octave`**: A branded octave value in the range `-1..9`.

## Core Types

### Notes

`Note` is the base value object for pitch spelling, MIDI conversion, and frequency conversion.

```ts
import { Note } from 'octavian';

const note = Note.create('Bb3');

note.note; // "Bb"
note.octave; // 3
note.midi; // 58
note.frequency; // 233.08...
note.enharmonics; // ["A#", "Cbb"]
```

Useful note operations:

```ts
const c = new Note('C', 4);

c.transpose('majorThird').toString(); // "E4"
c.transposeBy(1).toString(); // "C#4"
c.up().toString(); // "C5"
c.distanceTo('Bb4'); // "minorSeventh"
c.simplify().toString(); // sharp-preferred common spelling
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
findCanonicalIntervalBySemitonesAndDegree(6, 5); // "diminishedFifth"
applyInterval(new Note('F#', 4), 'majorThird').toString(); // "A#4"
INTERVALS.majorSixth.symbol; // "M6"
```

### Chords

`Chord` normalizes symbols and suffix aliases into a canonical suffix while keeping immutable note
collections.

`Chord.create` and `new Chord` both accept a root note string and a suffix; the difference is that
`Chord.create` additionally accepts a `SerializedChord` via `Chord.fromJSON` for round-tripping
persisted chord data.

```ts
import { Chord } from 'octavian';

const chord = new Chord('C4', 'maj7');

chord.name; // "Cmaj7"
chord.suffix; // "majorSeventh"
chord.quality; // "major"
chord.notes.map(String); // ["C4", "E4", "G4", "B4"]
chord.invert().name; // "Cmaj7/E"
chord.lowerFromTop(2).notes.map(String); // ["G3", "C4", "E4", "B4"]
```

Supported chord editing stays catalog-backed:

```ts
new Chord('C4', 'maj7').omit('majorSeventh').name; // "C"
new Chord('C4', 'major').add('majorSeventh').name; // "Cmaj7"
new Chord('C4', 'major').alter('perfectFifth', 'augmentedFifth').name; // "Caug"
```

### Scales

`Scale` builds theory-correct spellings from a root note and normalized scale type.

```ts
import { Scale } from 'octavian';

const scale = new Scale('C4', 'major');

scale.notes.map(String); // ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]
scale.relative('naturalMinor').toString(); // "A naturalMinor"
scale.parallel('naturalMinor').toString(); // "C naturalMinor"
scale.mode('lydian').toString(); // "F lydian"
scale.chord(5, 'seventh').name; // "G7"
```

Named modes are intentionally limited to the seven-note diatonic family. Other scale families still
support transposition, navigation, and pitch-class comparison.

## Parsing and Validation

The library exposes small validation helpers for common trust boundaries:

```ts
import {
  isChordSuffix,
  isChordSymbol,
  isInterval,
  isNoteName,
  isNoteNameWithOctave,
  isScaleType,
} from 'octavian';

isNoteName('Db'); // true
isNoteNameWithOctave('Db4'); // true
isInterval('sharpEleven'); // true
isChordSuffix('minorTriad'); // true
isChordSymbol('m7b5'); // true
isScaleType('mixolydian'); // true
```

Invalid input throws `TypeError` or `RangeError` from constructors and factory methods instead of
failing silently.

## MIDI and Frequency

The library uses standard equal temperament with `A4 = 440Hz`.

```ts
import { Note, STANDARD_TUNING } from 'octavian';

STANDARD_TUNING.frequency; // 440
Note.fromMidi(69).toString(); // "A4"
Note.fromFrequency(440).toString(); // "A4"
```

When a note is derived from MIDI or raw semitone movement, the result is simplified to a
sharp-preferred common spelling. When a note is derived from a spelled interval, the result
preserves theory-correct note letters.

## Development

Run the local quality gates with Bun:

```bash
bun run typecheck
bun run lint
bun test
bun run build
bun run validate
```
