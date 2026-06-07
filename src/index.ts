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

export {
  CHORDS,
  CHORD_SYMBOLS,
  chordQualityForSuffix,
  createChordName,
  createSlashChordName,
  resolveChordSuffix,
} from './chords.js';
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
  compoundInterval,
  consonanceOf,
  findCanonicalIntervalBySemitonesAndDegree,
  invertInterval,
  isConsonant,
  isDissonant,
  resolveInterval,
  simplifyInterval,
} from './intervals.js';
export type {
  CanonicalInterval,
  Interval,
  IntervalConsonance,
  IntervalInformation,
  IntervalQuality,
  IntervalSymbol,
  SimpleCanonicalInterval,
} from './intervals.js';

export type { AccidentalPreference, KeySignature } from './key-signatures.js';

export {
  KEY_SIGNATURES,
  keySignatureFor,
  keySignatureFromAccidentals,
} from './key-signature-catalog.js';
export type {
  AccidentalOrder,
  KeySignatureInformation,
  KeySignatureKey,
  KeySignatureMode,
} from './key-signature-catalog.js';

export {
  CIRCLE_OF_FIFTHS_MAJOR,
  CIRCLE_OF_FIFTHS_MINOR,
  adjacentKeys,
  circleOfFifths,
  distanceInFifths,
  enharmonicEquivalent,
  isOnCircleOfFifths,
} from './circle-of-fifths.js';

export { Key, isKnownKey } from './key.js';
export type { KeyLike, SerializedKey } from './key.js';

export { RomanNumeral } from './roman-numeral.js';
export type {
  RomanNumeralAlteration,
  RomanNumeralDegree,
  RomanNumeralInversion,
  RomanNumeralLike,
  RomanNumeralQuality,
  SerializedRomanNumeral,
} from './roman-numeral.js';

export { chordFromRomanNumeral, romanNumeralFor } from './key-roman.js';

export { identifyCadence, identifyCadenceSequence } from './cadence.js';
export type {
  CadenceInput,
  CadenceOccurrence,
  CadenceType,
  CadenceVoicing,
  VoicedCadenceChord,
} from './cadence.js';

export {
  harmonicFunctionFor,
  harmonicFunctionForAsAlias,
  harmonicFunctionForNumeral,
} from './harmonic-function.js';
export type { HarmonicFunction, HarmonicFunctionAlias } from './harmonic-function.js';

export {
  figuredBassForChord,
  figuredBassInversionFor,
  figuredBassToChord,
  formatFiguredBass,
  parseFiguredBass,
} from './figured-bass.js';
export type {
  FiguredBass,
  FiguredBassAccidental,
  FiguredBassDigit,
  FiguredBassFigure,
  FiguredBassInversion,
  FiguredBassLike,
} from './figured-bass.js';

export {
  ACCIDENTALS,
  ACCIDENTAL_OFFSETS,
  ALL_NOTE_NAMES,
  FLAT_PREFERRED_NOTE_NAMES,
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
  chromaticIndexToFrequency,
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

export { Note, applyInterval, noteToFrequency } from './note.js';
export type { NoteLike, SerializedNote } from './note.js';

export { randomNote, randomInterval } from './random.js';
export type { RandomFunction, RandomNoteOptions, RandomIntervalOptions } from './random.js';

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

export {
  KEYBOARD_25,
  KEYBOARD_49,
  KEYBOARD_61,
  KEYBOARD_76,
  KEYBOARD_88,
  highlightGroupsForChordOrScale,
  keyboardKeysForRange,
  keyboardPositionFor,
  keyboardRange,
  pianoKeyFor,
} from './piano-keyboard.js';
export type {
  HighlightTarget,
  KeyboardHighlight,
  KeyboardOptions,
  KeyboardPosition,
  KeyboardRange,
  PianoKey,
} from './piano-keyboard.js';

export {
  ZERO,
  ONE,
  addRationals,
  subtractRationals,
  multiplyRationals,
  divideRationals,
  rationalsEqual,
  compareRationals,
  createRational,
  formatRational,
  isZeroRational,
  rationalToNumber,
} from './rational.js';
export type { Rational } from './rational.js';

export { Duration, totalDurationFraction } from './duration.js';
export type {
  DurationOptions,
  DurationValue,
  SerializedDuration,
  TupletRatio,
} from './duration.js';

export { Meter, metersEqual } from './meter.js';
export type { MeterType, SerializedMeter } from './meter.js';

export { RhythmPattern, compareRhythm } from './rhythm.js';
export type {
  GridPosition,
  RhythmComparison,
  RhythmEvent,
  SwingDescriptor,
  SwingOffset,
} from './rhythm.js';

export {
  EQUAL_TEMPERAMENT,
  JUST_INTONATION,
  centsBetween,
  centsOffsetTemperament,
  edo,
  frequencyFor,
  tunedScale,
} from './temperament.js';
export type {
  CentsOffsetTemperament,
  EDO,
  EqualTemperament,
  FrequencyForOptions,
  JustIntonation,
  Temperament,
  TunedPitch,
  TunedScaleOptions,
} from './temperament.js';

export {
  createRatio,
  justIntonationRatiosFor,
  justRatioForSemitone,
  ratioCents,
  ratioValue,
} from './just-intonation.js';
export type { Ratio } from './just-intonation.js';
