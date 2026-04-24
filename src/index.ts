export {
  CHROMATIC_INDEXES,
  OCTAVES,
  createChromaticIndex,
  createFrequency,
  createMidiKey,
  createOctave,
  createSemitones,
} from './branded-types.js';
export type {
  Brand,
  ChromaticIndex,
  Frequency,
  MidiKey,
  Octave,
  Semitones,
} from './branded-types.js';

export { CHORDS, CHORD_SYMBOLS, chordQualityForSuffix, resolveChordSuffix } from './chords.js';
export type {
  ChordDegree,
  ChordDisplayName,
  ChordInformation,
  ChordName,
  ChordQuality,
  ChordSuffix,
  ChordSymbol,
  ChordType,
  InversionCount,
  SlashChordName,
  VoicingStrategy,
} from './chords.js';

export {
  INTERVALS,
  findCanonicalIntervalBySemitonesAndDegree,
  resolveInterval,
} from './intervals.js';
export type {
  CanonicalInterval,
  Interval,
  IntervalInformation,
  IntervalQuality,
  IntervalSymbol,
} from './intervals.js';

export type { AccidentalPreference, KeySignature } from './key-signatures.js';

export {
  ACCIDENTALS,
  ACCIDENTAL_OFFSETS,
  ALL_NOTE_NAMES,
  NATURALS,
  NATURAL_CHROMATIC_INDEXES,
  SHARP_PREFERRED_NOTE_NAMES,
  buildNoteName,
  enharmonicsForNoteName,
  normalizeChromaticIndex,
  noteNameToChromaticIndex,
  simplifyNoteName,
} from './note-spellings.js';
export type { Accidental, Natural, NoteName, NoteNameWithOctave } from './note-spellings.js';

export {
  isChordSuffix,
  isChordSymbol,
  isInterval,
  isNoteName,
  isNoteNameWithOctave,
  isScaleType,
  midiToFrequency,
  midiToNoteNameWithOctave,
  noteNameToMidi,
  parseNoteName,
  parseNoteNameWithOctave,
} from './music-utilities.js';

export { Note, applyInterval } from './note.js';
export type { NoteLike, SerializedNote } from './note.js';

export { Chord } from './chord.js';
export type { ChordVoicing, SerializedChord } from './chord.js';

export { Scale } from './scale.js';
export type { SerializedScale } from './scale.js';

export { SCALES, isDiatonicModeFamily, resolveScaleType, scaleTypeForMode } from './scales.js';
export type {
  CanonicalScaleType,
  ExtendedScaleDegree,
  ModeName,
  ScaleDegree,
  ScaleInformation,
  ScaleType,
} from './scales.js';

export { STANDARD_TUNING } from './tuning.js';
export type { Tuning } from './tuning.js';
