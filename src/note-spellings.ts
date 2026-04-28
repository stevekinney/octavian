import { createChromaticIndex, type ChromaticIndex, type Octave } from './branded-types.js';

/**
 * A natural note letter.
 */
export type Natural = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/**
 * A supported accidental suffix.
 */
export type Accidental = '' | '#' | 'b' | '##' | 'bb';

/**
 * A spelled note name without an octave.
 */
export type NoteName = `${Natural}${Accidental}`;

/**
 * A spelled note name with an octave suffix.
 */
export type NoteNameWithOctave = `${NoteName}${Octave}`;

/**
 * The natural note letters in staff order.
 */
export const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/**
 * The supported accidental suffixes.
 */
export const ACCIDENTALS = ['', '#', 'b', '##', 'bb'] as const;

/**
 * Natural note letters mapped to their pitch classes.
 */
export const NATURAL_CHROMATIC_INDEXES: Record<Natural, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
} satisfies Record<Natural, number>;

/**
 * Supported accidental offsets in semitones.
 */
export const ACCIDENTAL_OFFSETS: Record<Accidental, number> = {
  '': 0,
  '#': 1,
  b: -1,
  '##': 2,
  bb: -2,
} satisfies Record<Accidental, number>;

/**
 * Sharp-preferred spellings used when no tonal context is available.
 */
export const SHARP_PREFERRED_NOTE_NAMES: readonly NoteName[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] satisfies readonly NoteName[];

/**
 * The flat-preferred chromatic scale, one name per pitch class.
 */
export const FLAT_PREFERRED_NOTE_NAMES: readonly NoteName[] = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] satisfies readonly NoteName[];

/**
 * Every supported note name in this library.
 */
export const ALL_NOTE_NAMES: readonly NoteName[] = Object.freeze(
  NATURALS.flatMap((natural) =>
    ACCIDENTALS.map((accidental): NoteName => `${natural}${accidental}`),
  ),
);

/**
 * Extracts the natural letter from a note name.
 *
 * @param note The note name to inspect.
 * @returns The natural letter.
 */
export function naturalFromNoteName(note: NoteName): Natural {
  switch (note[0]) {
    case 'A':
      return 'A';
    case 'B':
      return 'B';
    case 'C':
      return 'C';
    case 'D':
      return 'D';
    case 'E':
      return 'E';
    case 'F':
      return 'F';
    case 'G':
      return 'G';
    default:
      throw new TypeError(`Unsupported note name: ${note}.`);
  }
}

/**
 * Extracts the accidental suffix from a note name.
 *
 * @param note The note name to inspect.
 * @returns The accidental suffix.
 */
export function accidentalFromNoteName(note: NoteName): Accidental {
  if (note.endsWith('##')) {
    return '##';
  }

  if (note.endsWith('bb')) {
    return 'bb';
  }

  if (note.endsWith('#')) {
    return '#';
  }

  if (note.endsWith('b')) {
    return 'b';
  }

  return '';
}

/**
 * Converts a note name to its pitch class.
 *
 * @param note The note name to inspect.
 * @returns The pitch class for the note.
 */
export function noteNameToChromaticIndex(note: NoteName): ChromaticIndex {
  const natural = naturalFromNoteName(note);
  const accidental = accidentalFromNoteName(note);

  return normalizeChromaticIndex(
    NATURAL_CHROMATIC_INDEXES[natural] + ACCIDENTAL_OFFSETS[accidental],
  );
}

/**
 * Converts a note name to its raw semitone offset within a theoretical octave.
 *
 * Unlike {@link noteNameToChromaticIndex}, this value is not normalized to `0..11`,
 * which preserves octave-crossing spellings such as `B#` and `Cb`.
 *
 * @param note The note name to inspect.
 * @returns The raw semitone offset for the note spelling.
 */
export function noteNameToRawSemitone(note: NoteName): number {
  const natural = naturalFromNoteName(note);
  const accidental = accidentalFromNoteName(note);

  return NATURAL_CHROMATIC_INDEXES[natural] + ACCIDENTAL_OFFSETS[accidental];
}

/**
 * Normalizes any integer to the `0..11` pitch-class range.
 *
 * @param value The raw semitone value to normalize.
 * @returns The normalized chromatic index.
 */
export function normalizeChromaticIndex(value: number): ChromaticIndex {
  const normalized = ((value % 12) + 12) % 12;

  return createChromaticIndex(normalized);
}

/**
 * Builds a note name from a natural letter and accidental offset.
 *
 * @param natural The target note letter.
 * @param accidentalOffset The accidental offset relative to the natural letter.
 * @returns The spelled note name.
 * @throws {RangeError} When the spelling would require accidentals beyond double sharps or flats.
 */
export function buildNoteName(natural: Natural, accidentalOffset: number): NoteName {
  switch (accidentalOffset) {
    case -2:
      return `${natural}bb`;
    case -1:
      return `${natural}b`;
    case 0:
      return natural;
    case 1:
      return `${natural}#`;
    case 2:
      return `${natural}##`;
    default:
      throw new RangeError(
        `Cannot spell ${natural} with an accidental offset of ${accidentalOffset}.`,
      );
  }
}

/**
 * Simplifies a note name to a common sharp-preferred spelling.
 *
 * @param note The note name to simplify.
 * @returns The simplified note name.
 */
export function simplifyNoteName(note: NoteName): NoteName {
  // SHARP_PREFERRED_NOTE_NAMES has exactly 12 entries and ChromaticIndex is always 0..11.
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  return SHARP_PREFERRED_NOTE_NAMES[noteNameToChromaticIndex(note)]!;
}

/**
 * Returns every supported enharmonic spelling for a note name, excluding the note itself.
 *
 * @param note The note name to inspect.
 * @returns Every alternate supported spelling for the same pitch class.
 */
export function enharmonicsForNoteName(note: NoteName): readonly NoteName[] {
  const chromaticIndex = noteNameToChromaticIndex(note);

  return Object.freeze(
    ALL_NOTE_NAMES.filter((candidate) => candidate !== note).filter(
      (candidate) => noteNameToChromaticIndex(candidate) === chromaticIndex,
    ),
  );
}
