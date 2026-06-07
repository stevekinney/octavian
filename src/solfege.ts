import { Key } from './key.js';
import { Note } from './note.js';
import type { NoteLike } from './note.js';
import type { Scale } from './scale.js';
import { degreeForNote, noteForDegree } from './scale-degree.js';
import type { ScaleDegreeAnalysis, ScaleDegreeNumber } from './scale-degree.js';

/**
 * The solfège system to use for formatting/parsing.
 *
 * - `'movableDo'` — Tonic-do system. The tonic of the key or scale is always
 *   `do`, regardless of its letter name. Diatonic major-scale degrees map to
 *   `do re mi fa sol la ti`. Chromatic notes use standard chromatic-solfège
 *   syllables for raised (`di ri fi si li`) and lowered (`ra me se le te`)
 *   alterations relative to the major-scale diatonic degrees at each position.
 *   When used with a minor key or scale, the tonic is still `do` (tonic-do
 *   convention, not la-based). Natural-minor diatonic notes therefore surface
 *   chromatic syllables at degrees 3, 6, and 7: the minor third is `me`, the
 *   minor sixth is `le`, the minor seventh is `te`.
 * - `'fixedDo'` — C is always `do`, regardless of key. All notes are analyzed
 *   relative to C major. Uses the same chromatic syllables as movable-do for
 *   non-diatonic-C notes (C#→`di`, Db→`ra`, etc.).
 */
export type SolfegeSystem = 'movableDo' | 'fixedDo';

// ---------------------------------------------------------------------------
// Syllable tables
// ---------------------------------------------------------------------------

/**
 * Diatonic movable-do syllables for degrees 1..7 in a major-scale context.
 * These are the base syllables before any chromatic alteration is applied.
 */
const DIATONIC_SYLLABLES: Record<ScaleDegreeNumber, string> = {
  1: 'do',
  2: 're',
  3: 'mi',
  4: 'fa',
  5: 'sol',
  6: 'la',
  7: 'ti',
};

/**
 * Chromatic solfège syllables for raised degrees (sharp by one semitone).
 */
const RAISED_SYLLABLES: Record<ScaleDegreeNumber, string> = {
  1: 'di',
  2: 'ri',
  3: 'mi', // #3 has no distinct standard chromatic name; maps to 'mi' (same as diatonic 3)
  4: 'fi',
  5: 'si',
  6: 'li',
  7: 'ti', // #7 = same pitch as 'do'; no distinct name; keep 'ti'
};

/**
 * Chromatic solfège syllables for lowered degrees (flat by one semitone).
 */
const LOWERED_SYLLABLES: Record<ScaleDegreeNumber, string> = {
  1: 'de',
  2: 'ra',
  3: 'me',
  4: 'fe',
  5: 'se',
  6: 'le',
  7: 'te',
};

// ---------------------------------------------------------------------------
// Reverse lookup table: syllable → {degree, alteration}
// ---------------------------------------------------------------------------

type SyllableInfo = { readonly degree: ScaleDegreeNumber; readonly alteration: '' | '#' | 'b' };

const SYLLABLE_TO_DEGREE: Record<string, SyllableInfo | undefined> = {};

// Build the reverse map — later entries override earlier ones on collision.
// Populate diatonic (empty alteration) first.
for (let d = 1; d <= 7; d++) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  const degree = d as ScaleDegreeNumber;
  SYLLABLE_TO_DEGREE[DIATONIC_SYLLABLES[degree]] = { degree, alteration: '' };
}
// Raised (#) — unique syllables take precedence (di, ri, fi, si, li)
for (let d = 1; d <= 7; d++) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  const degree = d as ScaleDegreeNumber;
  const syllable = RAISED_SYLLABLES[degree];
  if (!(syllable in SYLLABLE_TO_DEGREE)) {
    SYLLABLE_TO_DEGREE[syllable] = { degree, alteration: '#' };
  }
}
// Lowered (b) — unique syllables take precedence (ra, me, se, le, te, de, fe)
for (let d = 1; d <= 7; d++) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  const degree = d as ScaleDegreeNumber;
  const syllable = LOWERED_SYLLABLES[degree];
  if (!(syllable in SYLLABLE_TO_DEGREE)) {
    SYLLABLE_TO_DEGREE[syllable] = { degree, alteration: 'b' };
  }
}
// Explicitly assign the raised-only syllables to ensure correct alteration
SYLLABLE_TO_DEGREE['di'] = { degree: 1, alteration: '#' };
SYLLABLE_TO_DEGREE['ri'] = { degree: 2, alteration: '#' };
SYLLABLE_TO_DEGREE['fi'] = { degree: 4, alteration: '#' };
SYLLABLE_TO_DEGREE['si'] = { degree: 5, alteration: '#' };
SYLLABLE_TO_DEGREE['li'] = { degree: 6, alteration: '#' };

// ---------------------------------------------------------------------------
// Major-scale semitone reference (used for solfège syllable mapping)
//
// Solfège syllables in movable-do are always relative to the major-scale
// diatonic context: degree 3 always maps to 'mi' at +4 semitones, 'me' at
// +3 semitones, regardless of whether the underlying scale is major or minor.
// This is the traditional chromatic-solfège convention.
// ---------------------------------------------------------------------------

const MAJOR_SCALE_SEMITONES: Record<ScaleDegreeNumber, number> = {
  1: 0,
  2: 2,
  3: 4,
  4: 5,
  5: 7,
  6: 9,
  7: 11,
};

/**
 * Computes the solfège alteration relative to the major-scale expected semitone.
 * Returns -1 (lowered), 0 (diatonic/major), or 1 (raised).
 * For double alterations, returns the offset as-is.
 */
function majorRelativeOffset(degree: ScaleDegreeNumber, semitoneFromTonic: number): number {
  const majorSemitone = MAJOR_SCALE_SEMITONES[degree];
  const diff = (((semitoneFromTonic - majorSemitone) % 12) + 12) % 12;
  // Handle wrap-around: diff 11 = -1 (flat), diff 10 = -2 (double flat)
  if (diff === 0) return 0;
  if (diff === 1) return 1;
  if (diff === 11) return -1;
  if (diff === 2) return 2;
  if (diff === 10) return -2;
  return diff;
}

function semitoneForSyllableInfo(info: SyllableInfo): number {
  const major = MAJOR_SCALE_SEMITONES[info.degree];
  const offset = info.alteration === '#' ? 1 : info.alteration === 'b' ? -1 : 0;
  return (((major + offset) % 12) + 12) % 12;
}

// ---------------------------------------------------------------------------
// C-major scale (lazy singleton for fixedDo)
// ---------------------------------------------------------------------------

let cMajorKey: Key | null = null;

function getCMajorKey(): Key {
  if (cMajorKey === null) {
    cMajorKey = Key.create('C', 'major');
  }
  return cMajorKey;
}

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

function syllableForAnalysis(analysis: ScaleDegreeAnalysis): string {
  const { degree, semitoneFromTonic } = analysis;
  const offset = majorRelativeOffset(degree, semitoneFromTonic);

  if (offset === 0) return DIATONIC_SYLLABLES[degree];
  if (offset === 1) return RAISED_SYLLABLES[degree];
  if (offset === -1) return LOWERED_SYLLABLES[degree];
  // Double/triple alterations have no standard chromatic solfège name.
  // Fall back to the diatonic syllable with the signed offset appended.
  const sign = offset > 0 ? '+' : '';
  return `${DIATONIC_SYLLABLES[degree]}(${sign}${offset})`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the solfège syllable for a note in the given system and context.
 *
 * In `movableDo` mode, a context (key or scale) must be supplied. The tonic
 * always maps to `do` (tonic-do convention). In a minor key, the tonic is
 * still `do`; natural-minor notes at degrees 3/6/7 are `me`/`le`/`te`.
 *
 * In `fixedDo` mode, the context is ignored. C is always `do`.
 *
 * @param value The note to label.
 * @param system The solfège system.
 * @param context The key or scale context (required for `movableDo`).
 * @returns The solfège syllable string.
 * @throws {TypeError} When `movableDo` is used without a context, or the
 *   context is not heptatonic.
 */
export function formatSolfege(
  value: NoteLike,
  system: SolfegeSystem,
  context?: Key | Scale,
): string {
  if (system === 'fixedDo') {
    // C major is always heptatonic, so degreeForNote always returns non-null here.
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const analysis = degreeForNote(getCMajorKey().scale, value)!;
    return syllableForAnalysis(analysis);
  }

  // movableDo
  if (!context) {
    throw new TypeError('formatSolfege with movableDo requires a key or scale context.');
  }

  const analysis = degreeForNote(context, value);
  if (analysis === null) {
    throw new TypeError('formatSolfege with movableDo requires a heptatonic (7-note) context.');
  }

  return syllableForAnalysis(analysis);
}

/**
 * Parses a solfège syllable to a {@link Note} or {@link ScaleDegreeAnalysis}.
 *
 * In `fixedDo` mode, the syllable maps to a note in C major (`do`→C4, `re`→D4, …).
 * The `context` parameter is ignored.
 *
 * In `movableDo` mode with a context provided, the syllable resolves to a
 * concrete {@link Note} in that key or scale.
 *
 * In `movableDo` mode without a context, the syllable resolves to an abstract
 * {@link ScaleDegreeAnalysis} (degree + alteration; `semitoneFromTonic` is
 * computed relative to a major-scale tonic).
 *
 * @param syllable The solfège syllable to parse (case-insensitive).
 * @param system The solfège system.
 * @param context Optional key or scale for resolving a concrete note.
 * @returns A `Note` (with context or in fixedDo mode) or `ScaleDegreeAnalysis`.
 * @throws {TypeError} When the syllable is not recognized.
 */
export function parseSolfege(
  syllable: string,
  system: SolfegeSystem,
  context?: Key | Scale,
): Note | ScaleDegreeAnalysis {
  const lower = syllable.toLowerCase().trim();
  const info = SYLLABLE_TO_DEGREE[lower];

  if (!info) {
    throw new TypeError(`Unrecognized solfège syllable: "${syllable}".`);
  }

  const token = `${info.alteration}${info.degree}`;

  if (system === 'fixedDo') {
    // Resolve against C major
    return noteForDegree(getCMajorKey().scale, token);
  }

  // movableDo
  if (context) {
    return noteForDegree(context, token);
  }

  // No context: return abstract analysis
  const analysis: ScaleDegreeAnalysis = {
    degree: info.degree,
    alteration: info.alteration,
    semitoneFromTonic: semitoneForSyllableInfo(info),
  };
  return analysis;
}
