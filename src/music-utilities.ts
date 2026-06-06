import {
  createChromaticIndex,
  createFrequency,
  createMidiKey,
  createOctave,
  type Frequency,
  type MidiKey,
  type Octave,
} from './branded-types.js';
import { CHORDS, CHORD_SYMBOLS, type ChordSuffix, type ChordSymbol } from './chords.js';
import { INTERVALS, type Interval } from './intervals.js';
import {
  ALL_NOTE_NAMES,
  FLAT_PREFERRED_NOTE_NAMES,
  SHARP_PREFERRED_NOTE_NAMES,
  accidentalFromNoteName,
  naturalFromNoteName,
  noteNameToRawSemitone,
  type Accidental,
  type Natural,
  type NoteName,
} from './note-spellings.js';
import { SCALES, type ScaleType } from './scales.js';
import { STANDARD_TUNING, type Tuning } from './tuning.js';
import type { AccidentalPreference } from './key-signatures.js';

// Order matters in the alternation: triple accidentals must be tried before
// doubles before singles, otherwise `##` matches the first two chars of `###`.
const NOTE_WITH_OCTAVE_PATTERN = /^([A-G](?:###|bbb|##|bb|#|b)?)(-1|0|1|2|3|4|5|6|7|8|9)$/u;

const NOTE_NAME_SET = new Set<string>(ALL_NOTE_NAMES);
const INTERVAL_SET = new Set<string>(Object.keys(INTERVALS));
const CHORD_SUFFIX_SET = new Set<string>(Object.keys(CHORDS));
const CHORD_SYMBOL_SET = new Set<string>(CHORD_SYMBOLS);
const SCALE_TYPE_SET = new Set<string>(Object.keys(SCALES));

/**
 * Returns `true` when the value is a supported note name.
 *
 * @param value The value to inspect.
 * @returns `true` when the value is a supported note name.
 */
export function isNoteName(value: unknown): value is NoteName {
  return typeof value === 'string' && NOTE_NAME_SET.has(value);
}

/**
 * Returns `true` when the value is a supported note name with octave.
 *
 * @param value The value to inspect.
 * @returns `true` when the value is a supported note name with octave.
 */
export function isNoteNameWithOctave(value: unknown): value is `${NoteName}${Octave}` {
  return typeof value === 'string' && NOTE_WITH_OCTAVE_PATTERN.test(value);
}

/**
 * Returns `true` when the value is a supported interval name.
 *
 * @param value The value to inspect.
 * @returns `true` when the value is a supported interval name.
 */
export function isInterval(value: unknown): value is Interval {
  return typeof value === 'string' && INTERVAL_SET.has(value);
}

/**
 * Returns `true` when the value is a supported chord suffix.
 *
 * @param value The value to inspect.
 * @returns `true` when the value is a supported chord suffix.
 */
export function isChordSuffix(value: unknown): value is ChordSuffix {
  return typeof value === 'string' && CHORD_SUFFIX_SET.has(value);
}

/**
 * Returns `true` when the value is a supported chord symbol.
 *
 * @param value The value to inspect.
 * @returns `true` when the value is a supported chord symbol.
 */
export function isChordSymbol(value: unknown): value is ChordSymbol {
  return typeof value === 'string' && CHORD_SYMBOL_SET.has(value);
}

/**
 * Returns `true` when the value is a supported scale type.
 *
 * @param value The value to inspect.
 * @returns `true` when the value is a supported scale type.
 */
export function isScaleType(value: unknown): value is ScaleType {
  return typeof value === 'string' && SCALE_TYPE_SET.has(value);
}

/**
 * Parses a note name into its natural letter and accidental suffix.
 *
 * @param value The note name to parse.
 * @returns The parsed note components.
 * @throws {TypeError} When the value is not a supported note name.
 */
export function parseNoteName(value: unknown): {
  readonly note: NoteName;
  readonly natural: Natural;
  readonly accidental: Accidental;
} {
  if (!isNoteName(value)) {
    throw new TypeError(`Unsupported note name: ${String(value)}.`);
  }

  return {
    note: value,
    natural: naturalFromNoteName(value),
    accidental: accidentalFromNoteName(value),
  };
}

/**
 * Parses a note name with octave into its components.
 *
 * @param value The note string to parse.
 * @returns The parsed note and octave components.
 * @throws {TypeError} When the value is not a supported note string.
 */
export function parseNoteNameWithOctave(value: unknown): {
  readonly note: NoteName;
  readonly octave: Octave;
} {
  if (!isNoteNameWithOctave(value)) {
    throw new TypeError(`Unsupported note string: ${String(value)}.`);
  }
  const octaveStart = value.endsWith('-1') ? value.length - 2 : value.length - 1;
  const { note } = parseNoteName(value.slice(0, octaveStart));
  const octave = createOctave(Number(value.slice(octaveStart)));

  return {
    note,
    octave,
  };
}

/**
 * Converts a spelled note and octave to a MIDI key number.
 *
 * @param note The note name to convert.
 * @param octave The octave to convert.
 * @returns The validated MIDI key number.
 * @throws {RangeError} When the resulting MIDI key falls outside `0..127`.
 */
export function noteNameToMidi(note: NoteName, octave: Octave): MidiKey {
  const rawMidi = noteNameToRawSemitone(note) + 12 * (octave + 1);

  return createMidiKey(rawMidi);
}

/**
 * Converts a MIDI key number to a note spelling and octave.
 *
 * @param midi The MIDI key to convert.
 * @param accidentalPreference Whether to prefer sharps or flats for ambiguous pitch classes. Defaults to `'sharps'`.
 * @returns The note spelling and octave.
 */
export function midiToNoteNameWithOctave(
  midi: MidiKey,
  accidentalPreference: AccidentalPreference = 'sharps',
): {
  readonly note: NoteName;
  readonly octave: Octave;
} {
  const numericMidi = Number(midi);
  const octave = createOctave(Math.floor(numericMidi / 12) - 1);
  const chromaticIndex = createChromaticIndex(numericMidi % 12);
  const noteNames =
    accidentalPreference === 'flats' ? FLAT_PREFERRED_NOTE_NAMES : SHARP_PREFERRED_NOTE_NAMES;
  // Both arrays have exactly 12 entries and ChromaticIndex is always 0..11.
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const note = noteNames[chromaticIndex]!;

  return { note, octave };
}

/**
 * Converts a MIDI key to a frequency using equal temperament.
 *
 * Accepts either a branded {@link MidiKey} or a plain `number` (validated internally).
 *
 * @param midi The MIDI key to convert. Plain numbers are validated against the 0..127 range.
 * @param tuning The tuning reference to use.
 * @returns The frequency in hertz.
 * @throws {RangeError} When a plain number falls outside the MIDI range `0..127`.
 */
export function midiToFrequency(
  midi: number | MidiKey,
  tuning: Tuning = STANDARD_TUNING,
): Frequency {
  const validatedMidi = createMidiKey(Number(midi));
  const numericFrequency = Number(tuning.frequency) * 2 ** ((Number(validatedMidi) - 69) / 12);

  return createFrequency(numericFrequency);
}

/**
 * Converts a pitch-class (0..11) and octave to a frequency using equal temperament.
 *
 * @param pitchClass The chromatic index in the range `0..11`.
 * @param octave The octave in the range `-1..9`.
 * @param tuning The tuning reference to use. Defaults to standard tuning (A4 = 440 Hz).
 * @returns The frequency in hertz.
 * @throws {RangeError} When `pitchClass` is not in `0..11` or `octave` is not in `-1..9`.
 */
export function chromaticIndexToFrequency(
  pitchClass: number,
  octave: number,
  tuning: Tuning = STANDARD_TUNING,
): Frequency {
  createChromaticIndex(pitchClass);
  const midi = createMidiKey((createOctave(octave) + 1) * 12 + pitchClass);

  return midiToFrequency(midi, tuning);
}

/**
 * Converts a frequency to the nearest MIDI key using equal temperament.
 *
 * @param frequency The frequency to convert.
 * @param tuning The tuning reference to use.
 * @returns The nearest MIDI key number.
 * @throws {RangeError} When the rounded MIDI key falls outside `0..127`.
 */
export function frequencyToNearestMidi(
  frequency: number,
  tuning: Tuning = STANDARD_TUNING,
): MidiKey {
  const rawMidi = Math.round(69 + 12 * Math.log2(frequency / Number(tuning.frequency)));

  return createMidiKey(rawMidi);
}
