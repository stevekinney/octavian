import type {
  NoteName,
  ChordSuffix,
  ScaleType,
  Interval,
  MidiKey,
  Frequency,
  Semitones,
  Octave,
} from 'octavian';
import {
  Note,
  Chord,
  Scale,
  INTERVALS,
  CHORDS,
  SCALES,
  STANDARD_TUNING,
  createOctave,
} from 'octavian';

// Quick-start examples from README
const cSharp: Note = new Note('C#', createOctave(4));
const eb: Note = cSharp.transpose('minorThird');
const c4: Note = new Note('C', createOctave(4));
const cMajorSeven: Chord = Chord.create(c4, 'maj7');
const cMajor: Scale = Scale.create(c4, 'major');

// Type-check key types
const _noteName: NoteName = 'C#';
const _suffix: ChordSuffix = 'majorSeventh';
const _scaleType: ScaleType = 'major';
const _interval: Interval = 'majorThird';

export { cSharp, eb, c4, cMajorSeven, cMajor, INTERVALS, CHORDS, SCALES, STANDARD_TUNING };
export type { MidiKey, Frequency, Semitones, Octave };
