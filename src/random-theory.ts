import { Chord } from './chord.js';
import {
  chordQualityForSuffix,
  resolveChordSuffix,
  type CanonicalChordSuffix,
  type ChordQuality,
  type ChordSuffix,
  type InversionCount,
} from './chords.js';
import { Key } from './key.js';
import type { KeySignatureMode } from './key-signature-catalog.js';
import { Note } from './note.js';
import type { NoteName } from './note-spellings.js';
import { pick, type RandomFunction } from './random.js';
import {
  RomanNumeral,
  type RomanNumeralDegree,
  type RomanNumeralQuality,
} from './roman-numeral.js';
import { Scale } from './scale.js';
import { degreeForNote, type KeyOrScale, type ScaleDegreeAnalysis } from './scale-degree.js';
import { resolveScaleType, type CanonicalScaleType, type ScaleType } from './scales.js';

// ---------------------------------------------------------------------------
// randomChord
// ---------------------------------------------------------------------------

/**
 * Options for {@link randomChord}.
 */
export type RandomChordOptions = {
  /** Constrain the root to notes in this key (pitch classes only). */
  readonly key?: Key;
  /** Explicit pool of allowed chord suffixes. Defaults to all canonical suffixes. */
  readonly suffixes?: readonly ChordSuffix[];
  /** Constrain by high-level chord quality. Applied after suffix filtering. */
  readonly qualities?: readonly ChordQuality[];
  /** Explicit pool of allowed root note names. */
  readonly roots?: readonly NoteName[];
  /** Apply a specific inversion index to the resulting chord. */
  readonly inversion?: InversionCount;
  /** Random-number source. Defaults to {@link Math.random}. */
  readonly random?: RandomFunction;
};

const ALL_CANONICAL_SUFFIXES: readonly CanonicalChordSuffix[] = Object.freeze([
  'major',
  'minor',
  'diminished',
  'augmented',
  'suspendedSecond',
  'suspendedFourth',
  'majorSixth',
  'minorSixth',
  'dominantSeventh',
  'majorSeventh',
  'minorSeventh',
  'minorMajorSeventh',
  'diminishedSeventh',
  'halfDiminishedSeventh',
  'augmentedSeventh',
  'augmentedMajorSeventh',
  'dominantSevenFlatNine',
  'dominantSevenSharpNine',
  'dominantSevenFlatFive',
  'dominantSevenSharpFive',
  'dominantSevenSharpEleven',
  'dominantSevenFlatThirteen',
  'dominantNinth',
  'majorNinth',
  'minorNinth',
  'dominantEleventh',
  'majorEleventh',
  'minorEleventh',
  'dominantThirteenth',
  'majorThirteenth',
  'minorThirteenth',
  'addNine',
  'minorAddNine',
  'sixthAddNine',
] satisfies readonly CanonicalChordSuffix[]);

const ALL_NOTE_NAMES_BASIC: readonly NoteName[] = Object.freeze([
  'C',
  'D',
  'E',
  'F',
  'G',
  'A',
  'B',
  'C#',
  'D#',
  'F#',
  'G#',
  'A#',
  'Db',
  'Eb',
  'Gb',
  'Ab',
  'Bb',
] as const);

function buildChordSuffixPool(
  suffixes: readonly ChordSuffix[] | undefined,
  qualities: readonly ChordQuality[] | undefined,
): readonly CanonicalChordSuffix[] {
  let pool: readonly CanonicalChordSuffix[] = suffixes
    ? suffixes.map((s) => resolveChordSuffix(s))
    : ALL_CANONICAL_SUFFIXES;

  if (qualities && qualities.length > 0) {
    const qualitySet = new Set(qualities);
    pool = pool.filter((s) => qualitySet.has(chordQualityForSuffix(s)));
  }

  if (pool.length === 0) {
    throw new TypeError(
      'randomChord: the combination of suffixes and qualities produced an empty pool.',
    );
  }

  return pool;
}

function buildChordRootPool(
  roots: readonly NoteName[] | undefined,
  key: Key | undefined,
): readonly NoteName[] {
  if (roots !== undefined) {
    return roots;
  }
  if (key) {
    return key.scale.notes.map((n) => n.note);
  }
  return ALL_NOTE_NAMES_BASIC;
}

/**
 * Selects a random {@link Chord} constrained by key, allowed suffix/quality, root pool,
 * and optional inversion.
 *
 * @param options Constraints for chord selection.
 * @returns The selected chord.
 * @throws {TypeError} When the resulting suffix or root pool is empty.
 */
export function randomChord(options: RandomChordOptions = {}): Chord {
  const random = options.random ?? Math.random;
  const suffixPool = buildChordSuffixPool(options.suffixes, options.qualities);
  const rootPool = buildChordRootPool(options.roots, options.key);

  if (rootPool.length === 0) {
    throw new TypeError('randomChord: the root pool is empty.');
  }

  const root = pick(rootPool, random);
  const suffix = pick(suffixPool, random);
  const chord = Chord.create(Note.create(root), suffix);

  return options.inversion !== undefined ? chord.inversion(options.inversion) : chord;
}

// ---------------------------------------------------------------------------
// randomScale
// ---------------------------------------------------------------------------

/**
 * Options for {@link randomScale}.
 */
export type RandomScaleOptions = {
  /** Pool of allowed scale types. Defaults to all canonical scale types. */
  readonly types?: readonly ScaleType[];
  /** Explicit pool of allowed root note names. */
  readonly roots?: readonly NoteName[];
  /** Random-number source. Defaults to {@link Math.random}. */
  readonly random?: RandomFunction;
};

const ALL_CANONICAL_SCALE_TYPES: readonly CanonicalScaleType[] = Object.freeze([
  'major',
  'naturalMinor',
  'harmonicMinor',
  'melodicMinor',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'locrian',
  'majorPentatonic',
  'minorPentatonic',
  'blues',
  'chromatic',
  'wholeTone',
  'diminished',
  'halfWholeDiminished',
]);

/**
 * Selects a random {@link Scale} constrained by allowed scale types and root pool.
 *
 * @param options Constraints for scale selection.
 * @returns The selected scale.
 * @throws {TypeError} When the type or root pool is empty.
 */
export function randomScale(options: RandomScaleOptions = {}): Scale {
  const random = options.random ?? Math.random;

  const typePool: readonly CanonicalScaleType[] =
    options.types !== undefined
      ? options.types.map((t) => resolveScaleType(t))
      : ALL_CANONICAL_SCALE_TYPES;

  if (typePool.length === 0) {
    throw new TypeError('randomScale: the scale type pool is empty.');
  }

  const rootPool: readonly NoteName[] =
    options.roots !== undefined ? options.roots : ALL_NOTE_NAMES_BASIC;

  if (rootPool.length === 0) {
    throw new TypeError('randomScale: the root pool is empty.');
  }

  const root = pick(rootPool, random);
  const type = pick(typePool, random);

  return Scale.create(Note.create(root), type);
}

// ---------------------------------------------------------------------------
// randomRomanNumeral
// ---------------------------------------------------------------------------

/**
 * Options for {@link randomRomanNumeral}.
 */
export type RandomRomanNumeralOptions = {
  /** Pool of allowed scale degrees (1–7). Defaults to all seven degrees. */
  readonly degrees?: readonly RomanNumeralDegree[];
  /** Pool of allowed qualities. Defaults to all four qualities. */
  readonly qualities?: readonly RomanNumeralQuality[];
  /** The key mode, used to determine default qualities when none are specified. */
  readonly mode?: KeySignatureMode;
  /** Random-number source. Defaults to {@link Math.random}. */
  readonly random?: RandomFunction;
};

const ALL_DEGREES: readonly RomanNumeralDegree[] = Object.freeze([1, 2, 3, 4, 5, 6, 7]);
const ALL_QUALITIES: readonly RomanNumeralQuality[] = Object.freeze([
  'major',
  'minor',
  'diminished',
  'augmented',
]);

/**
 * Selects a random {@link RomanNumeral} constrained by degree and quality pools.
 *
 * The returned numeral is always in root position (inversion `'5/3'`), with
 * no alteration or applied target. These can be refined by the caller.
 *
 * @param options Constraints for Roman numeral selection.
 * @returns The selected Roman numeral.
 * @throws {TypeError} When either the degree or quality pool is empty.
 */
export function randomRomanNumeral(options: RandomRomanNumeralOptions = {}): RomanNumeral {
  const random = options.random ?? Math.random;

  const degreePool: readonly RomanNumeralDegree[] =
    options.degrees !== undefined ? options.degrees : ALL_DEGREES;

  if (degreePool.length === 0) {
    throw new TypeError('randomRomanNumeral: the degree pool is empty.');
  }

  const qualityPool: readonly RomanNumeralQuality[] =
    options.qualities !== undefined ? options.qualities : ALL_QUALITIES;

  if (qualityPool.length === 0) {
    throw new TypeError('randomRomanNumeral: the quality pool is empty.');
  }

  const degree = pick(degreePool, random);
  const quality = pick(qualityPool, random);

  return RomanNumeral.fromJSON({ degree, quality, inversion: '5/3' });
}

// ---------------------------------------------------------------------------
// randomRomanNumeralSequence
// ---------------------------------------------------------------------------

/**
 * Options for {@link randomRomanNumeralSequence}.
 */
export type RandomRomanNumeralSequenceOptions = {
  /** The number of Roman numerals in the sequence. Defaults to 4. */
  readonly length?: number;
  /** Pool of allowed scale degrees (1–7). Defaults to all seven degrees. */
  readonly degrees?: readonly RomanNumeralDegree[];
  /** Pool of allowed qualities. Defaults to all four qualities. */
  readonly qualities?: readonly RomanNumeralQuality[];
  /** The key mode context. */
  readonly mode?: KeySignatureMode;
  /** Random-number source. Defaults to {@link Math.random}. */
  readonly random?: RandomFunction;
};

/**
 * Generates a sequence of random {@link RomanNumeral} values, suitable for use
 * as a chord progression template.
 *
 * Note: this function does not depend on the {@link Progression} type from issue #22.
 * A `randomProgression` wrapper returning a `Progression` instance is a follow-up
 * once that branch merges.
 *
 * @param options Constraints for the sequence.
 * @returns A frozen array of Roman numerals.
 * @throws {TypeError} When the degree or quality pool is empty, or length is not a
 *   positive integer.
 */
export function randomRomanNumeralSequence(
  options: RandomRomanNumeralSequenceOptions = {},
): readonly RomanNumeral[] {
  const { length = 4, degrees, qualities, mode, random } = options;

  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError(
      `randomRomanNumeralSequence: length must be a positive integer, received ${length}.`,
    );
  }

  const numeralOptions: RandomRomanNumeralOptions = {
    ...(degrees !== undefined ? { degrees } : {}),
    ...(qualities !== undefined ? { qualities } : {}),
    ...(mode !== undefined ? { mode } : {}),
    ...(random !== undefined ? { random } : {}),
  };

  return Object.freeze(Array.from({ length }, () => randomRomanNumeral(numeralOptions)));
}

// ---------------------------------------------------------------------------
// randomScaleDegree
// ---------------------------------------------------------------------------

/**
 * Options for {@link randomScaleDegree}.
 */
export type RandomScaleDegreeOptions = {
  /** The key or scale context to analyze within. */
  readonly context: KeyOrScale;
  /** Random-number source. Defaults to {@link Math.random}. */
  readonly random?: RandomFunction;
};

/**
 * Selects a random note from the context scale and returns its
 * {@link ScaleDegreeAnalysis}.
 *
 * The context must be a heptatonic (7-note) scale or key; non-heptatonic
 * contexts throw a {@link RangeError}.
 *
 * @param options The scale/key context and optional random-number function.
 * @returns The scale-degree analysis for the selected note.
 * @throws {RangeError} When the context is not a heptatonic scale or key.
 */
export function randomScaleDegree(options: RandomScaleDegreeOptions): ScaleDegreeAnalysis {
  const { context, random = Math.random } = options;

  // Extract the underlying Scale from either a Key or a Scale instance.
  const scale: Scale = context instanceof Key ? context.scale : context;
  const notes = scale.notes;

  if (notes.length !== 7) {
    throw new RangeError(
      `randomScaleDegree requires a heptatonic (7-note) scale; got a ${notes.length}-note scale.`,
    );
  }

  const note = pick(notes, random);
  // degreeForNote returns null only for non-heptatonic scales; we already
  // threw above if notes.length !== 7, so null is unreachable here.
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  return degreeForNote(context, note)!;
}
