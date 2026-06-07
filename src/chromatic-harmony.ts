// chromatic-harmony.ts: recognition of chromatic chords in a key context.
// Construction of these chords is handled by chordFromRomanNumeral in
// key-roman.ts (which already supports alteration prefixes like bVII and
// applied-chord notation like V/V). This module focuses purely on
// IDENTIFICATION — given a key and a chord, produce a RomanNumeral that
// describes it, or null when recognition fails.

import type { Chord } from './chord.js';
import type { ChordSuffix } from './chords.js';
import type { Key } from './key.js';
import {
  unsafeRomanNumeralFromParts,
  type RomanNumeral,
  type RomanNumeralAlteration,
  type RomanNumeralDegree,
  type RomanNumeralInversion,
  type RomanNumeralQuality,
} from './roman-numeral.js';

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

/**
 * Attempts to identify `chord` as a chromatic Roman numeral in `key`.
 *
 * Checks secondary dominants, secondary leading-tone chords, borrowed
 * chords, and the Neapolitan in that order. Returns the first match, or
 * `null` when no recognized chromatic pattern applies.
 *
 * @param key The tonal key providing context.
 * @param chord The chord to analyse.
 * @returns The identified Roman numeral, or `null`.
 */
export function identifyChromaticRomanNumeral(key: Key, chord: Chord): RomanNumeral | null {
  return (
    identifySecondaryDominant(key, chord) ??
    identifySecondaryLeadingTone(key, chord) ??
    identifyBorrowed(key, chord) ??
    identifyNeapolitan(key, chord)
  );
}

// ---------------------------------------------------------------------------
// Secondary dominants: V/x and V7/x
// ---------------------------------------------------------------------------

/**
 * Identifies a chord as a secondary dominant (V/x or V7/x) in `key`.
 *
 * For each diatonic scale degree x, the secondary dominant is a major
 * triad or dominant-seventh chord whose root lies a perfect fifth above
 * the root of degree x. Diatonic degrees are tried in order 1..7; the
 * first match wins.
 *
 * @param key The tonal key providing context.
 * @param chord The chord to analyse.
 * @returns A secondary-dominant Roman numeral or `null`.
 */
function identifySecondaryDominant(key: Key, chord: Chord): RomanNumeral | null {
  if (chord.suffix !== 'major' && chord.suffix !== 'dominantSeventh') {
    return null;
  }
  const isSeventh = chord.suffix === 'dominantSeventh';
  const diatonicRoots = key.diatonicChords().map((c) => c.root.chromaticIndex);
  const inversion = inversionForChord(chord, isSeventh);

  for (let i = 0; i < diatonicRoots.length; i++) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const tonicIdx = diatonicRoots[i]!;
    // V of degree (i+1) has root a perfect fifth (7 semitones) above that
    // degree's tonic.
    const dominantRootIdx = (tonicIdx + 7) % 12;
    if (chord.root.chromaticIndex !== dominantRootIdx) {
      continue;
    }
    // When the applied target is degree I (the tonic itself), the chord is
    // the plain harmonic-minor V — not a secondary dominant. Emit V without
    // an applied target so it reads "V", not "V/I".
    if (i === 0) {
      return unsafeRomanNumeralFromParts(5, 'major', inversion, undefined, undefined);
    }
    return unsafeRomanNumeralFromParts(
      5,
      'major',
      inversion,
      undefined,
      diatonicRomanNumeralForDegree(key, i),
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Secondary leading-tone chords: vii°/x and vii°7/x
// ---------------------------------------------------------------------------

/**
 * Identifies a chord as a secondary leading-tone chord (vii°/x or
 * vii°7/x) in `key`.
 *
 * The leading-tone chord of a temporary tonic x is a diminished (or
 * half-/fully-diminished-seventh) chord built a semitone below x.
 *
 * @param key The tonal key providing context.
 * @param chord The chord to analyse.
 * @returns A secondary leading-tone Roman numeral or `null`.
 */
function identifySecondaryLeadingTone(key: Key, chord: Chord): RomanNumeral | null {
  if (!isDiminishedSuffix(chord.suffix)) {
    return null;
  }
  const isSeventh = chord.size === 4;
  const diatonicRoots = key.diatonicChords().map((c) => c.root.chromaticIndex);
  const inversion = inversionForChord(chord, isSeventh);

  for (let i = 0; i < diatonicRoots.length; i++) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const tonicIdx = diatonicRoots[i]!;
    // Leading tone is one semitone below the temporary tonic.
    const leadingToneIdx = (tonicIdx - 1 + 12) % 12;
    if (chord.root.chromaticIndex !== leadingToneIdx) {
      continue;
    }
    // When the applied target is degree I (the tonic itself), the chord is
    // the plain harmonic-minor vii° — not a secondary leading-tone chord.
    // Emit vii° without an applied target so it reads "vii°", not "vii°/I".
    if (i === 0) {
      return unsafeRomanNumeralFromParts(7, 'diminished', inversion, undefined, undefined);
    }
    return unsafeRomanNumeralFromParts(
      7,
      'diminished',
      inversion,
      undefined,
      diatonicRomanNumeralForDegree(key, i),
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Borrowed chords (modal mixture)
// ---------------------------------------------------------------------------

/**
 * Identifies a chord as a borrowed chord from the parallel key.
 *
 * For each diatonic degree 1..7 of the parallel key, this function checks
 * whether `chord` matches a chord produced at that degree. The alteration
 * between the home-key and parallel-key scale degrees is reported as
 * `flat` or `sharp` (or `undefined` when the same pitch class).
 *
 * @param key The tonal key providing context.
 * @param chord The chord to analyse.
 * @returns A borrowed-chord Roman numeral or `null`.
 */
function identifyBorrowed(key: Key, chord: Chord): RomanNumeral | null {
  const parallel = key.parallelKey;
  const isSeventh = chord.size === 4;
  const parallelChords = isSeventh ? parallel.diatonicSeventhChords() : parallel.diatonicChords();
  const homeChords = isSeventh ? key.diatonicSeventhChords() : key.diatonicChords();

  for (let i = 0; i < parallelChords.length; i++) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const pc = parallelChords[i]!;
    if (pc.root.chromaticIndex !== chord.root.chromaticIndex) {
      continue;
    }
    if (pc.suffix !== chord.suffix) {
      continue;
    }
    // Skip when the same chord is already diatonic in the home key —
    // that case is handled by the diatonic check upstream.
    const homeChord = homeChords[i];
    if (
      homeChord !== undefined &&
      homeChord.root.chromaticIndex === chord.root.chromaticIndex &&
      homeChord.suffix === chord.suffix
    ) {
      continue;
    }
    // i is guaranteed 0..6 from the parallelChords iteration; both
    // DEGREES_BY_INDEX access and qualityForSuffix are safe here.
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const degree = DEGREES_BY_INDEX[i]!;
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const quality = qualityForSuffix(chord.suffix)!;
    const homeScaleNote = key.scale.degree(degree);
    const parallelScaleNote = parallel.scale.degree(degree);
    const alteration = degreeAlteration(
      homeScaleNote.chromaticIndex,
      parallelScaleNote.chromaticIndex,
    );
    const inversion = inversionForChord(chord, isSeventh);
    return unsafeRomanNumeralFromParts(degree, quality, inversion, alteration, undefined);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Neapolitan: bII
// ---------------------------------------------------------------------------

/**
 * Identifies a chord as the Neapolitan (♭II) in `key`.
 *
 * The Neapolitan is a major triad built on the chromatically lowered
 * second degree of the scale (one semitone above the tonic). It appears
 * in both major and minor keys.
 *
 * @param key The tonal key providing context.
 * @param chord The chord to analyse.
 * @returns A Neapolitan Roman numeral (♭II or ♭II⁷) or `null`.
 */
function identifyNeapolitan(key: Key, chord: Chord): RomanNumeral | null {
  if (chord.suffix !== 'major' && chord.suffix !== 'majorSeventh') {
    return null;
  }
  const neapolitanRootIdx = (key.tonic.chromaticIndex + 1) % 12;
  if (chord.root.chromaticIndex !== neapolitanRootIdx) {
    return null;
  }
  const isSeventh = chord.suffix === 'majorSeventh';
  const inversion = inversionForChord(chord, isSeventh);
  return unsafeRomanNumeralFromParts(2, 'major', inversion, 'flat', undefined);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a simple diatonic Roman numeral for the chord at scale-degree
 * index `i` (0-based). Used as the `/x` target in applied-chord notation.
 * The caller guarantees `i` is in 0..6 (from a diatonic-chord loop), so
 * both `degreeFromIndex` and the diatonic-chord array access are safe.
 *
 * @param key The tonal key.
 * @param i Zero-based degree index (0..6).
 * @returns A root-position diatonic Roman numeral.
 */
function diatonicRomanNumeralForDegree(key: Key, i: number): RomanNumeral {
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const degree = DEGREES_BY_INDEX[i]!;
  const diatonicChords = key.diatonicChords();
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const diatonicChord = diatonicChords[i]!;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const quality = qualityForSuffix(diatonicChord.suffix)!;
  return unsafeRomanNumeralFromParts(degree, quality, '5/3', undefined, undefined);
}

const DEGREES_BY_INDEX: readonly RomanNumeralDegree[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Determines the alteration of `parallelIdx` relative to `homeIdx`.
 *
 * Returns `'flat'` when the parallel degree is one semitone lower,
 * `'sharp'` when one semitone higher, and `undefined` when equal (same
 * pitch class — not a borrowed chord).
 *
 * @param homeIdx The chromatic index of the home-key scale degree.
 * @param parallelIdx The chromatic index of the parallel-key scale degree.
 * @returns The alteration direction, or `undefined` when unaltered.
 */
function degreeAlteration(
  homeIdx: number,
  parallelIdx: number,
): RomanNumeralAlteration | undefined {
  const up = (parallelIdx - homeIdx + 12) % 12;
  if (up === 0) {
    return undefined;
  }
  // up==1 → parallel is one semitone higher → sharp alteration.
  // up==11 → parallel is one semitone lower (wrapped) → flat alteration.
  // For the standard minor/major pair, only ±1 semitones occur at degrees
  // 3, 6, and 7.
  return up <= 6 ? 'sharp' : 'flat';
}

const QUALITY_BY_SUFFIX: ReadonlyMap<ChordSuffix, RomanNumeralQuality> = new Map<
  ChordSuffix,
  RomanNumeralQuality
>([
  ['major', 'major'],
  ['majorSeventh', 'major'],
  ['dominantSeventh', 'major'],
  ['minor', 'minor'],
  ['minorSeventh', 'minor'],
  ['minorMajorSeventh', 'minor'],
  ['diminished', 'diminished'],
  ['diminishedSeventh', 'diminished'],
  ['halfDiminishedSeventh', 'diminished'],
  ['augmented', 'augmented'],
  ['augmentedSeventh', 'augmented'],
  ['augmentedMajorSeventh', 'augmented'],
]);

function qualityForSuffix(suffix: ChordSuffix): RomanNumeralQuality | null {
  return QUALITY_BY_SUFFIX.get(suffix) ?? null;
}

const TRIAD_INVERSION_TABLE: readonly RomanNumeralInversion[] = ['5/3', '6', '6/4'];
const SEVENTH_INVERSION_TABLE: readonly RomanNumeralInversion[] = ['7', '6/5', '4/3', '4/2'];

function inversionForChord(chord: Chord, isSeventh: boolean): RomanNumeralInversion {
  const table = isSeventh ? SEVENTH_INVERSION_TABLE : TRIAD_INVERSION_TABLE;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  return table[chord.inversionIndex] ?? table[0]!;
}

const DIMINISHED_SUFFIXES: ReadonlySet<ChordSuffix> = new Set<ChordSuffix>([
  'diminished',
  'diminishedSeventh',
  'halfDiminishedSeventh',
]);

function isDiminishedSuffix(suffix: ChordSuffix): boolean {
  return DIMINISHED_SUFFIXES.has(suffix);
}
