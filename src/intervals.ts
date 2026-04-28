/**
 * The quality component of a melodic or harmonic interval.
 */
export type IntervalQuality = 'perfect' | 'major' | 'minor' | 'augmented' | 'diminished';

/**
 * The consonance/dissonance classification for an interval, per the
 * common-practice taxonomy used in *Aldwell & Schachter* and similar texts.
 *
 * - `perfect-consonance`: P1, P5, P8 (also compound forms).
 * - `imperfect-consonance`: M3, m3, M6, m6 (and compound forms).
 * - `mild-dissonance`: M2, m7 (and compound forms).
 * - `sharp-dissonance`: m2, M7, A4 / d5 (the tritone), and compound forms.
 *
 * Note on the perfect fourth: P4 is consonant melodically and against
 * upper voices, but dissonant against the bass — this catalog classifies
 * P4 as `perfect-consonance` (the standard taxonomy choice). Callers
 * needing bass-relative analysis should layer their own check on top.
 */
export type IntervalConsonance =
  | 'perfect-consonance'
  | 'imperfect-consonance'
  | 'mild-dissonance'
  | 'sharp-dissonance';

/**
 * The four foundational fields every interval entry carries.
 *
 * Internal source-data shape used by the catalog literal. Public consumers
 * read enriched entries from {@link INTERVALS}, which always populate the
 * additional fields on {@link IntervalInformation}.
 */
type BaseIntervalInformation = {
  readonly semitones: number;
  readonly symbol: string;
  readonly degree: number;
  readonly quality: IntervalQuality;
};

/**
 * Structured information about an interval as exposed via {@link INTERVALS}.
 *
 * `simpleInterval` and `octaveOffset` describe how this interval relates
 * to its degree-1-through-8 simple form. Consonance classification is
 * exposed via {@link consonanceOf}, {@link isConsonant}, and
 * {@link isDissonant} rather than as a field on this type — single source
 * of truth, no catalog-vs-function divergence.
 */
export type IntervalInformation = BaseIntervalInformation & {
  /** Canonical interval after octave-removal (P11 → P4, M9 → M2). */
  readonly simpleInterval: CanonicalInterval;
  /** Number of octaves above the simple form (0 for simple, 1+ for compound). */
  readonly octaveOffset: number;
};

/**
 * The canonical interval names used for computed output.
 */
export type CanonicalInterval =
  | 'perfectUnison'
  | 'diminishedSecond'
  | 'minorSecond'
  | 'augmentedUnison'
  | 'majorSecond'
  | 'diminishedThird'
  | 'minorThird'
  | 'augmentedSecond'
  | 'majorThird'
  | 'diminishedFourth'
  | 'perfectFourth'
  | 'augmentedThird'
  | 'augmentedFourth'
  | 'diminishedFifth'
  | 'perfectFifth'
  | 'diminishedSixth'
  | 'minorSixth'
  | 'augmentedFifth'
  | 'majorSixth'
  | 'diminishedSeventh'
  | 'minorSeventh'
  | 'augmentedSixth'
  | 'majorSeventh'
  | 'diminishedOctave'
  | 'perfectOctave'
  | 'minorNinth'
  | 'augmentedOctave'
  | 'majorNinth'
  | 'diminishedTenth'
  | 'minorTenth'
  | 'augmentedNinth'
  | 'majorTenth'
  | 'diminishedEleventh'
  | 'perfectEleventh'
  | 'augmentedTenth'
  | 'augmentedEleventh'
  | 'diminishedTwelfth'
  | 'perfectTwelfth'
  | 'minorThirteenth'
  | 'augmentedTwelfth'
  | 'majorThirteenth'
  | 'diminishedFourteenth';

/**
 * The accepted interval alias names.
 */
type IntervalAliasKey =
  | 'unison'
  | 'halfStep'
  | 'semitone'
  | 'wholeStep'
  | 'wholeTone'
  | 'tone'
  | 'tritone'
  | 'octave'
  | 'flatNine'
  | 'ninth'
  | 'eleventh'
  | 'sharpEleven'
  | 'twelfth'
  | 'flatThirteen'
  | 'thirteenth';

/**
 * Every accepted interval name, including aliases.
 */
export type Interval = CanonicalInterval | IntervalAliasKey;

const CANONICAL_INTERVALS: Record<CanonicalInterval, BaseIntervalInformation> = {
  perfectUnison: { semitones: 0, symbol: 'P1', degree: 1, quality: 'perfect' },
  diminishedSecond: { semitones: 0, symbol: 'd2', degree: 2, quality: 'diminished' },
  minorSecond: { semitones: 1, symbol: 'm2', degree: 2, quality: 'minor' },
  augmentedUnison: { semitones: 1, symbol: 'A1', degree: 1, quality: 'augmented' },
  majorSecond: { semitones: 2, symbol: 'M2', degree: 2, quality: 'major' },
  diminishedThird: { semitones: 2, symbol: 'd3', degree: 3, quality: 'diminished' },
  minorThird: { semitones: 3, symbol: 'm3', degree: 3, quality: 'minor' },
  augmentedSecond: { semitones: 3, symbol: 'A2', degree: 2, quality: 'augmented' },
  majorThird: { semitones: 4, symbol: 'M3', degree: 3, quality: 'major' },
  diminishedFourth: { semitones: 4, symbol: 'd4', degree: 4, quality: 'diminished' },
  perfectFourth: { semitones: 5, symbol: 'P4', degree: 4, quality: 'perfect' },
  augmentedThird: { semitones: 5, symbol: 'A3', degree: 3, quality: 'augmented' },
  augmentedFourth: { semitones: 6, symbol: 'A4', degree: 4, quality: 'augmented' },
  diminishedFifth: { semitones: 6, symbol: 'd5', degree: 5, quality: 'diminished' },
  perfectFifth: { semitones: 7, symbol: 'P5', degree: 5, quality: 'perfect' },
  diminishedSixth: { semitones: 7, symbol: 'd6', degree: 6, quality: 'diminished' },
  minorSixth: { semitones: 8, symbol: 'm6', degree: 6, quality: 'minor' },
  augmentedFifth: { semitones: 8, symbol: 'A5', degree: 5, quality: 'augmented' },
  majorSixth: { semitones: 9, symbol: 'M6', degree: 6, quality: 'major' },
  diminishedSeventh: { semitones: 9, symbol: 'd7', degree: 7, quality: 'diminished' },
  minorSeventh: { semitones: 10, symbol: 'm7', degree: 7, quality: 'minor' },
  augmentedSixth: { semitones: 10, symbol: 'A6', degree: 6, quality: 'augmented' },
  majorSeventh: { semitones: 11, symbol: 'M7', degree: 7, quality: 'major' },
  diminishedOctave: { semitones: 11, symbol: 'd8', degree: 8, quality: 'diminished' },
  perfectOctave: { semitones: 12, symbol: 'P8', degree: 8, quality: 'perfect' },
  minorNinth: { semitones: 13, symbol: 'm9', degree: 9, quality: 'minor' },
  augmentedOctave: { semitones: 13, symbol: 'A8', degree: 8, quality: 'augmented' },
  majorNinth: { semitones: 14, symbol: 'M9', degree: 9, quality: 'major' },
  diminishedTenth: { semitones: 14, symbol: 'd10', degree: 10, quality: 'diminished' },
  minorTenth: { semitones: 15, symbol: 'm10', degree: 10, quality: 'minor' },
  augmentedNinth: { semitones: 15, symbol: 'A9', degree: 9, quality: 'augmented' },
  majorTenth: { semitones: 16, symbol: 'M10', degree: 10, quality: 'major' },
  diminishedEleventh: { semitones: 16, symbol: 'd11', degree: 11, quality: 'diminished' },
  perfectEleventh: { semitones: 17, symbol: 'P11', degree: 11, quality: 'perfect' },
  augmentedTenth: { semitones: 17, symbol: 'A10', degree: 10, quality: 'augmented' },
  augmentedEleventh: { semitones: 18, symbol: 'A11', degree: 11, quality: 'augmented' },
  diminishedTwelfth: { semitones: 18, symbol: 'd12', degree: 12, quality: 'diminished' },
  perfectTwelfth: { semitones: 19, symbol: 'P12', degree: 12, quality: 'perfect' },
  minorThirteenth: { semitones: 20, symbol: 'm13', degree: 13, quality: 'minor' },
  augmentedTwelfth: { semitones: 20, symbol: 'A12', degree: 12, quality: 'augmented' },
  majorThirteenth: { semitones: 21, symbol: 'M13', degree: 13, quality: 'major' },
  diminishedFourteenth: { semitones: 21, symbol: 'd14', degree: 14, quality: 'diminished' },
} satisfies Record<CanonicalInterval, BaseIntervalInformation>;

const INTERVAL_ALIAS_DEFINITIONS: Record<IntervalAliasKey, BaseIntervalInformation> = {
  unison: CANONICAL_INTERVALS.perfectUnison,
  halfStep: CANONICAL_INTERVALS.minorSecond,
  semitone: CANONICAL_INTERVALS.minorSecond,
  wholeStep: CANONICAL_INTERVALS.majorSecond,
  wholeTone: CANONICAL_INTERVALS.majorSecond,
  tone: CANONICAL_INTERVALS.majorSecond,
  tritone: CANONICAL_INTERVALS.augmentedFourth,
  octave: CANONICAL_INTERVALS.perfectOctave,
  flatNine: CANONICAL_INTERVALS.minorNinth,
  ninth: CANONICAL_INTERVALS.majorNinth,
  eleventh: CANONICAL_INTERVALS.perfectEleventh,
  sharpEleven: CANONICAL_INTERVALS.augmentedEleventh,
  twelfth: CANONICAL_INTERVALS.perfectTwelfth,
  flatThirteen: CANONICAL_INTERVALS.minorThirteenth,
  thirteenth: CANONICAL_INTERVALS.majorThirteenth,
} satisfies Record<IntervalAliasKey, BaseIntervalInformation>;

// Lookup tables hoisted ahead of `INTERVALS` enrichment so the enrichment
// helper can reference them. Also used by public functions further below.
const CANONICAL_INTERVAL_LOOKUP = new Map<string, CanonicalInterval>(
  Object.entries(CANONICAL_INTERVALS).map(([interval, information]) => [
    `${information.semitones}:${information.degree}`,
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    interval as CanonicalInterval,
  ]),
);

/**
 * The canonical intervals at simple-interval scope (degree 1–8).
 *
 * `consonanceOf` simplifies any compound interval to one of these via
 * {@link simplifyInterval}, so only simple-form classifications need to be
 * tabulated. Keeping the table narrow eliminates a class of correctness
 * bugs where compound entries would have to be hand-classified to match
 * what their simple form already specifies.
 */
export type SimpleCanonicalInterval =
  | 'perfectUnison'
  | 'augmentedUnison'
  | 'diminishedSecond'
  | 'minorSecond'
  | 'majorSecond'
  | 'augmentedSecond'
  | 'diminishedThird'
  | 'minorThird'
  | 'majorThird'
  | 'augmentedThird'
  | 'diminishedFourth'
  | 'perfectFourth'
  | 'augmentedFourth'
  | 'diminishedFifth'
  | 'perfectFifth'
  | 'augmentedFifth'
  | 'diminishedSixth'
  | 'minorSixth'
  | 'majorSixth'
  | 'augmentedSixth'
  | 'diminishedSeventh'
  | 'minorSeventh'
  | 'majorSeventh'
  | 'diminishedOctave'
  | 'perfectOctave'
  | 'augmentedOctave';

const SIMPLE_CONSONANCE_TABLE: Readonly<Record<SimpleCanonicalInterval, IntervalConsonance>> = {
  perfectUnison: 'perfect-consonance',
  perfectFifth: 'perfect-consonance',
  perfectOctave: 'perfect-consonance',
  perfectFourth: 'perfect-consonance',
  majorThird: 'imperfect-consonance',
  minorThird: 'imperfect-consonance',
  majorSixth: 'imperfect-consonance',
  minorSixth: 'imperfect-consonance',
  majorSecond: 'mild-dissonance',
  minorSeventh: 'mild-dissonance',
  minorSecond: 'sharp-dissonance',
  majorSeventh: 'sharp-dissonance',
  augmentedFourth: 'sharp-dissonance',
  diminishedFifth: 'sharp-dissonance',
  augmentedUnison: 'sharp-dissonance',
  diminishedSecond: 'sharp-dissonance',
  diminishedThird: 'sharp-dissonance',
  augmentedSecond: 'sharp-dissonance',
  diminishedFourth: 'sharp-dissonance',
  augmentedThird: 'sharp-dissonance',
  diminishedSixth: 'sharp-dissonance',
  augmentedFifth: 'sharp-dissonance',
  diminishedSeventh: 'sharp-dissonance',
  augmentedSixth: 'sharp-dissonance',
  diminishedOctave: 'sharp-dissonance',
  augmentedOctave: 'sharp-dissonance',
};

function computeSimpleForm(degree: number, semitones: number): SimpleCanonicalInterval {
  // The catalog covers every (simpleSemitones, simpleDegree) pair this
  // function can ever be asked about, so the lookup is guaranteed to hit.
  // Callers are: catalog enrichment (valid by construction) and
  // simplifyInterval (only invoked on degree > 8, which always has a simple
  // form in the catalog). Asserting via `!` keeps coverage faithful.
  const simpleDegree = ((degree - 1) % 7) + 1;
  const simpleSemitones = semitones % 12;
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return CANONICAL_INTERVAL_LOOKUP.get(
    `${simpleSemitones}:${simpleDegree}`,
  )! as SimpleCanonicalInterval;
}

function enrichIntervalInformation(
  canonical: CanonicalInterval,
  base: BaseIntervalInformation,
): IntervalInformation {
  const octaveOffset = base.degree <= 8 ? 0 : Math.floor((base.degree - 1) / 7);
  const simpleInterval =
    octaveOffset === 0 ? canonical : computeSimpleForm(base.degree, base.semitones);
  return {
    ...base,
    simpleInterval,
    octaveOffset,
  };
}

function buildEnrichedIntervals(): Record<Interval, IntervalInformation> {
  const result: Partial<Record<Interval, IntervalInformation>> = {};
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  for (const canonical of Object.keys(CANONICAL_INTERVALS) as readonly CanonicalInterval[]) {
    result[canonical] = enrichIntervalInformation(canonical, CANONICAL_INTERVALS[canonical]);
  }
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  for (const alias of Object.keys(INTERVAL_ALIAS_DEFINITIONS) as readonly IntervalAliasKey[]) {
    const canonical = resolveInterval(alias);
    result[alias] = enrichIntervalInformation(canonical, INTERVAL_ALIAS_DEFINITIONS[alias]);
  }
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return result as Record<Interval, IntervalInformation>;
}

/**
 * Structured interval definitions, including accepted aliases.
 *
 * Every entry carries the foundational fields (`semitones`, `symbol`,
 * `degree`, `quality`) plus the enrichment fields added in roadmap
 * item 1.2 (`simpleInterval`, `octaveOffset`). Consonance classification
 * is exposed via {@link consonanceOf}, {@link isConsonant}, and
 * {@link isDissonant} (roadmap item 1.3) — not as a field on this type.
 */
export const INTERVALS: Readonly<Record<Interval, IntervalInformation>> =
  Object.freeze(buildEnrichedIntervals());

/**
 * The shorthand notation used to display an interval.
 */
export type IntervalSymbol = (typeof INTERVALS)[Interval]['symbol'];

/**
 * Resolves an interval name or alias to its canonical interval name.
 *
 * @param interval The interval name or alias to resolve.
 * @returns The canonical interval name.
 */
// oxlint-disable-next-line eslint(complexity)
export function resolveInterval(interval: Interval): CanonicalInterval {
  switch (interval) {
    case 'unison':
      return 'perfectUnison';
    case 'halfStep':
    case 'semitone':
      return 'minorSecond';
    case 'wholeStep':
    case 'wholeTone':
    case 'tone':
      return 'majorSecond';
    case 'tritone':
      return 'augmentedFourth';
    case 'octave':
      return 'perfectOctave';
    case 'flatNine':
      return 'minorNinth';
    case 'ninth':
      return 'majorNinth';
    case 'eleventh':
      return 'perfectEleventh';
    case 'sharpEleven':
      return 'augmentedEleventh';
    case 'twelfth':
      return 'perfectTwelfth';
    case 'flatThirteen':
      return 'minorThirteenth';
    case 'thirteenth':
      return 'majorThirteenth';
    default:
      return interval;
  }
}

/**
 * Finds a canonical interval from its semitone distance and diatonic degree.
 *
 * @param semitones The interval size in semitones.
 * @param degree The interval degree.
 * @returns The canonical interval name, or `null` when the pair is not represented.
 */
export function findCanonicalIntervalBySemitonesAndDegree(
  semitones: number,
  degree: number,
): CanonicalInterval | null {
  return CANONICAL_INTERVAL_LOOKUP.get(`${semitones}:${degree}`) ?? null;
}

/**
 * Inverts a simple interval (P5 → P4, M3 → m6, A4 → d5, P1 → P8).
 *
 * The inversion of an interval `n` is the interval that completes an
 * octave with it: `n + invert(n) = P8`. Quality flips between major and
 * minor, augmented and diminished; perfect stays perfect.
 *
 * Compound intervals are first simplified, then inverted; the result is
 * always a simple interval (1–8).
 *
 * @throws {RangeError} when the interval has no defined inversion (e.g.,
 *   intervals beyond an octave that don't simplify cleanly — currently
 *   none, but the guard is here for future extensions).
 */
export function invertInterval(interval: Interval): CanonicalInterval {
  const canonical = resolveInterval(interval);
  const simple = simplifyInterval(canonical);
  const simpleInfo = CANONICAL_INTERVALS[simple];
  const newDegree = 9 - simpleInfo.degree;
  const newSemitones = 12 - simpleInfo.semitones;
  const result = findCanonicalIntervalBySemitonesAndDegree(newSemitones, newDegree);
  if (!result) {
    throw new RangeError(
      `No inversion defined for interval "${interval}" — its inverse (semitones=${newSemitones}, degree=${newDegree}) is not in the catalog.`,
    );
  }
  return result;
}

/**
 * Reduces an interval to its simple form (P11 → P4, M9 → M2).
 *
 * The result is always a degree-1-through-8 ("simple") interval: degrees
 * 1–7 within an octave plus the perfect/augmented/diminished octaves
 * themselves. A compound interval (degree > 8) is reduced to its
 * within-octave equivalent with the same quality. Intervals already at
 * simple scope are returned unchanged.
 */
export function simplifyInterval(interval: Interval): SimpleCanonicalInterval {
  const canonical = resolveInterval(interval);
  const information = CANONICAL_INTERVALS[canonical];
  if (information.degree <= 8) {
    // canonical has degree ≤ 8 by the guard, so it's a SimpleCanonicalInterval.
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return canonical as SimpleCanonicalInterval;
  }
  return computeSimpleForm(information.degree, information.semitones);
}

/**
 * Extends a simple interval by `octaves`, producing a compound interval.
 *
 * `compoundInterval('perfectFourth', 1) === 'perfectEleventh'`.
 * `compoundInterval('majorSecond', 1) === 'majorNinth'`.
 *
 * @throws {RangeError} when `octaves` is negative or non-integer, or when
 *   the resulting interval is not represented in the catalog.
 */
export function compoundInterval(interval: Interval, octaves: number): CanonicalInterval {
  if (!Number.isInteger(octaves) || octaves < 0) {
    throw new RangeError(`Octaves must be a non-negative integer; got ${octaves}.`);
  }
  if (octaves === 0) {
    return resolveInterval(interval);
  }
  const canonical = resolveInterval(interval);
  const information = CANONICAL_INTERVALS[canonical];
  const targetDegree = information.degree + 7 * octaves;
  const targetSemitones = information.semitones + 12 * octaves;
  const result = findCanonicalIntervalBySemitonesAndDegree(targetSemitones, targetDegree);
  if (!result) {
    throw new RangeError(
      `Cannot compound interval "${interval}" by ${octaves} octave(s) — result (semitones=${targetSemitones}, degree=${targetDegree}) is not in the catalog.`,
    );
  }
  return result;
}

/**
 * Returns whether an interval is consonant per the common-practice taxonomy.
 *
 * Consonant: perfect consonances (P1/P5/P8), imperfect consonances
 * (M3/m3/M6/m6), and their compound forms.
 */
export function isConsonant(interval: Interval): boolean {
  const consonance = consonanceOf(interval);
  return consonance === 'perfect-consonance' || consonance === 'imperfect-consonance';
}

/**
 * Returns whether an interval is dissonant per the common-practice taxonomy.
 *
 * Dissonant: mild dissonances (M2/m7) and sharp dissonances (m2/M7/A4/d5),
 * and their compound forms. The complement of {@link isConsonant}.
 */
export function isDissonant(interval: Interval): boolean {
  return !isConsonant(interval);
}

/**
 * Returns the consonance classification for an interval.
 */
export function consonanceOf(interval: Interval): IntervalConsonance {
  const simple = simplifyInterval(interval);
  return SIMPLE_CONSONANCE_TABLE[simple];
}
