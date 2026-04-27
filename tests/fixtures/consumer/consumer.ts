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
import { Note, Chord, Scale, INTERVALS, CHORDS, SCALES, STANDARD_TUNING } from 'octavian';

// Quick-start examples from README
const cSharp: Note = Note.create('C#4');
const eb: Note = cSharp.transpose('minorThird');
const cMajorSeven: Chord = Chord.create('C4', 'maj7');
const cMajor: Scale = Scale.create('C4', 'major');

// Type-check key types
const _noteName: NoteName = 'C#';
const _suffix: ChordSuffix = 'majorSeventh';
const _scaleType: ScaleType = 'major';
const _interval: Interval = 'majorThird';

export { cSharp, eb, cMajorSeven, cMajor, INTERVALS, CHORDS, SCALES, STANDARD_TUNING };
export type { MidiKey, Frequency, Semitones, Octave };
