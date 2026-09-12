import type {
  NoteName,
  ChordSuffix,
  ScaleType,
  Interval,
  MidiKey,
  Frequency,
  Semitones,
  Octave,
  IdentifiedChord,
  GuitarFingering,
  PianoVoicing,
} from 'octavian';
import {
  Note,
  Chord,
  Scale,
  INTERVALS,
  CHORDS,
  SCALES,
  STANDARD_TUNING,
  identifyChords,
  identifyGuitarChords,
  identifyPianoChords,
  guitarFingeringsFor,
  pianoVoicingsFor,
} from 'octavian';

const identified: readonly IdentifiedChord[] = identifyChords(['C4', 64, Note.fromMidi(67)], {
  key: 'C major',
});
const guitar: IterableIterator<GuitarFingering> = guitarFingeringsFor('C');
const piano: IterableIterator<PianoVoicing> = pianoVoicingsFor('C/E');
identifyGuitarChords([null, 3, 2, 0, 1, 0]);
identifyPianoChords([60, 64, 67]);
export { identified, guitar, piano };

// Quick-start examples from README
const cSharp: Note = Note.create({ note: 'C#', octave: 4 });
const eb: Note = cSharp.transpose('minorThird');
const c4: Note = Note.create({ note: 'C', octave: 4 });
const cMajorSeven: Chord = Chord.create(c4, 'maj7');
const cMajor: Scale = Scale.create(c4, 'major');

// Type-check key types
const _noteName: NoteName = 'C#';
const _suffix: ChordSuffix = 'majorSeventh';
const _scaleType: ScaleType = 'major';
const _interval: Interval = 'majorThird';

export { cSharp, eb, c4, cMajorSeven, cMajor, INTERVALS, CHORDS, SCALES, STANDARD_TUNING };
export type { MidiKey, Frequency, Semitones, Octave };
