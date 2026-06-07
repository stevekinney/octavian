import type { ChromaticIndex } from './branded-types.js';
import type { Key } from './key.js';
import { Note, type NoteLike } from './note.js';
import type { Accidental, Natural } from './note-spellings.js';
import {
  ACCIDENTAL_OFFSETS,
  NATURALS,
  accidentalFromNoteName,
  buildNoteName,
  naturalFromNoteName,
  normalizeChromaticIndex,
} from './note-spellings.js';
import type { Scale } from './scale.js';

/**
 * A scale degree number in the range 1..7.
 */
export type ScaleDegreeNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * The chromatic alteration of a note relative to its diatonic scale degree.
 *
 * - `''` — no alteration (the note matches the diatonic degree exactly).
 * - `'#'` / `'##'` / `'###'` — one, two, or three semitones raised.
 * - `'b'` / `'bb'` / `'bbb'` — one, two, or three semitones lowered.
 */
export type ScaleDegreeAlteration = Accidental;

/**
 * The result of analyzing a note's position within a key or scale context.
 *
 * Used by {@link degreeForNote}, the solfège helpers, and roadmap item #35.
 *
 * The `degree` field is spelling-based (derived from letter distance from the
 * tonic natural letter) so it extends consistently to chromatic degrees.
 * `alteration` is the accidental difference between this note and the purely
 * diatonic note at the same degree (empty string means no alteration).
 * `semitoneFromTonic` is the chromatic distance upward from the tonic pitch
 * class, always in 0..11.
 */
export type ScaleDegreeAnalysis = {
  readonly degree: ScaleDegreeNumber;
  readonly alteration: ScaleDegreeAlteration;
  readonly semitoneFromTonic: ChromaticIndex;
};

/**
 * A key-or-scale context accepted by degree-analysis helpers.
 */
export type KeyOrScale = Key | Scale;

/**
 * A degree token string, either a plain degree `'1'..'7'` or a chromatic
 * token such as `'b2'`, `'#4'`, `'b7'`, `'##5'`, etc.
 */
export type DegreeToken = string;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Extracts the Scale object and its root note from either a Key or Scale. */
function extractScale(context: KeyOrScale): { scale: Scale; tonic: Note } {
  // Key has a `tonic` getter and a `scale` getter; Scale has a `root` getter.
  if ('tonic' in context && 'scale' in context) {
    return { scale: context.scale, tonic: context.tonic };
  }
  return { scale: context, tonic: context.root };
}

/** The seven natural letters in staff order (C D E F G A B). */
const NATURAL_COUNT = 7;

/**
 * Returns the zero-based staff position (0=C, 1=D, … 6=B) for a Natural.
 */
function naturalPosition(natural: Natural): number {
  return NATURALS.indexOf(natural);
}

/**
 * Returns the letter-based scale degree (1–7) of a note relative to a tonic.
 *
 * The degree is derived purely from the letter distance in staff order, so it
 * is correct for both diatonic and chromatic notes and preserves enharmonic
 * spelling intent (e.g., Eb is degree 3 in C, not degree 2 like D#).
 */
function letterDegree(tonicNatural: Natural, noteNatural: Natural): ScaleDegreeNumber {
  const tonicPos = naturalPosition(tonicNatural);
  const notePos = naturalPosition(noteNatural);
  const diff = (((notePos - tonicPos) % NATURAL_COUNT) + NATURAL_COUNT) % NATURAL_COUNT;
  // diff is 0..6; degree is 1..7
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return (diff + 1) as ScaleDegreeNumber;
}

const VALID_ALTERATIONS = new Set<string>(['', '#', 'b', '##', 'bb', '###', 'bbb']);

function parseAlteration(altString: string, token: DegreeToken): ScaleDegreeAlteration {
  if (!VALID_ALTERATIONS.has(altString)) {
    throw new TypeError(`Unsupported accidental in degree token: "${token}".`);
  }
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return altString as ScaleDegreeAlteration;
}

/**
 * Parses a degree token string into `{ degree, alteration }`.
 *
 * Accepted formats: `'1'..'7'` and `'b2'`/`'#4'`/`'bb3'`/`'##6'` etc.
 */
function parseDegreeToken(token: DegreeToken): {
  degree: ScaleDegreeNumber;
  alteration: ScaleDegreeAlteration;
} {
  const match = /^([b#]*)([\d])$/.exec(token);
  if (!match) {
    throw new TypeError(`Unrecognized degree token: "${token}".`);
  }
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const altString = match[1]!;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const degreeNum = parseInt(match[2]!, 10);
  if (degreeNum < 1 || degreeNum > 7) {
    throw new RangeError(`Degree token degree must be 1..7, got ${degreeNum}.`);
  }
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  const degree = degreeNum as ScaleDegreeNumber;
  const alteration = parseAlteration(altString, token);
  return { degree, alteration };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the scale-degree analysis for a note in the given key or scale
 * context, or `null` when the context is not a seven-note (heptatonic) scale
 * (i.e., degree positions 1–7 are not all defined).
 *
 * For heptatonic contexts the analysis is always non-null: diatonic notes
 * return an empty alteration (`''`), while chromatic notes return the
 * appropriate accidental alteration relative to the diatonic degree note at
 * the same letter position.
 *
 * The degree is spelling-based (derived from the note letter, not pitch
 * class), so enharmonic spellings yield different analyses:
 * Eb → {degree: 3, alteration: 'b'} and D# → {degree: 2, alteration: '#'}
 * in C major are both correct representations of their respective spellings.
 *
 * @param context The key or scale to analyze within.
 * @param value The note to analyze.
 * @returns The analysis object, or `null` for non-heptatonic scales.
 */
export function degreeForNote(context: KeyOrScale, value: NoteLike): ScaleDegreeAnalysis | null {
  const { scale, tonic } = extractScale(context);

  // Only heptatonic (7-note) scales have well-defined 1..7 degrees.
  if (scale.size !== 7) {
    return null;
  }

  const note = Note.create(value);
  const tonicNatural = naturalFromNoteName(tonic.note);
  const noteNatural = naturalFromNoteName(note.note);

  const degree = letterDegree(tonicNatural, noteNatural);

  // The diatonic note at this degree (zero-indexed: degree-1)
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const diatonicNote = scale.notes[degree - 1]!;
  const diatonicAccOffset = ACCIDENTAL_OFFSETS[accidentalFromNoteName(diatonicNote.note)];
  const inputAccOffset = ACCIDENTAL_OFFSETS[accidentalFromNoteName(note.note)];
  const alterationOffset = inputAccOffset - diatonicAccOffset;

  // Build the alteration as an Accidental string
  let alteration: ScaleDegreeAlteration;
  switch (alterationOffset) {
    case -3:
      alteration = 'bbb';
      break;
    case -2:
      alteration = 'bb';
      break;
    case -1:
      alteration = 'b';
      break;
    case 0:
      alteration = '';
      break;
    case 1:
      alteration = '#';
      break;
    case 2:
      alteration = '##';
      break;
    case 3:
      alteration = '###';
      break;
    default:
      throw new RangeError(
        `Alteration offset ${alterationOffset} exceeds supported accidental range (±3) for note ${note.note}.`,
      );
  }

  // semitoneFromTonic: chromatic distance upward (mod 12), typed 0..11.
  const semitoneFromTonic = normalizeChromaticIndex(note.chromaticIndex - tonic.chromaticIndex);

  return { degree, alteration, semitoneFromTonic };
}

/**
 * Returns the spelled {@link Note} for a degree token in the given key or
 * scale context.
 *
 * The token is a degree number `'1'..'7'` or a chromatic token such as
 * `'b3'`, `'#4'`, `'b7'`, `'##5'`. The octave of the returned note is the
 * same as the tonic octave (or higher if the diatonic note wraps above the
 * octave boundary — consistent with how `Scale.degree` behaves).
 *
 * The spelling is derived from the diatonic degree note's letter with the
 * token's accidental applied, preserving enharmonic intent:
 * `noteForDegree(Cmaj, 'b3')` returns Eb (not D#).
 *
 * @param context The key or scale to use.
 * @param token A degree token such as `'3'`, `'b7'`, or `'#4'`.
 * @returns The spelled note for the degree.
 * @throws {TypeError} When the token format is not recognized.
 * @throws {RangeError} When the degree is out of 1..7 or the context is not heptatonic.
 */
export function noteForDegree(context: KeyOrScale, token: DegreeToken): Note {
  const { scale } = extractScale(context);

  if (scale.size !== 7) {
    throw new RangeError(
      `noteForDegree requires a heptatonic (7-note) scale; got a ${scale.size}-note scale.`,
    );
  }

  const { degree, alteration } = parseDegreeToken(token);

  // Diatonic note at this degree
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const diatonicNote = scale.notes[degree - 1]!;
  const diatonicNatural = naturalFromNoteName(diatonicNote.note);
  const diatonicAccOffset = ACCIDENTAL_OFFSETS[accidentalFromNoteName(diatonicNote.note)];
  const tokenAccOffset = ACCIDENTAL_OFFSETS[alteration];
  const targetAccOffset = diatonicAccOffset + tokenAccOffset;

  const targetNoteName = buildNoteName(diatonicNatural, targetAccOffset);

  return Note.create({ note: targetNoteName, octave: diatonicNote.octave });
}
