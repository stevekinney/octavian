/**
 * The quality component of a melodic or harmonic interval.
 */
export type IntervalQuality = 'perfect' | 'major' | 'minor' | 'augmented' | 'diminished';

/**
 * Structured information about an interval.
 */
export type IntervalInformation = {
  readonly semitones: number;
  readonly symbol: string;
  readonly degree: number;
  readonly quality: IntervalQuality;
};

const CANONICAL_INTERVALS = {
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
} as const satisfies Record<string, IntervalInformation>;

const INTERVAL_ALIASES = {
  unison: 'perfectUnison',
  halfStep: 'minorSecond',
  semitone: 'minorSecond',
  wholeStep: 'majorSecond',
  wholeTone: 'majorSecond',
  tone: 'majorSecond',
  tritone: 'augmentedFourth',
  octave: 'perfectOctave',
  flatNine: 'minorNinth',
  ninth: 'majorNinth',
  eleventh: 'perfectEleventh',
  sharpEleven: 'augmentedEleventh',
  twelfth: 'perfectTwelfth',
  flatThirteen: 'minorThirteenth',
  thirteenth: 'majorThirteenth',
} as const satisfies Record<string, keyof typeof CANONICAL_INTERVALS>;

const INTERVAL_ALIAS_DEFINITIONS = {
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
} as const satisfies Record<keyof typeof INTERVAL_ALIASES, IntervalInformation>;

/**
 * The canonical interval names used for computed output.
 */
export type CanonicalInterval = keyof typeof CANONICAL_INTERVALS;

/**
 * Every accepted interval name, including aliases.
 */
export type Interval = CanonicalInterval | keyof typeof INTERVAL_ALIASES;

/**
 * Structured interval definitions, including accepted aliases.
 */
export const INTERVALS = Object.freeze({
  ...CANONICAL_INTERVALS,
  ...INTERVAL_ALIAS_DEFINITIONS,
}) satisfies Readonly<Record<Interval, IntervalInformation>>;

const CANONICAL_INTERVAL_LOOKUP = new Map<string, CanonicalInterval>(
  Object.entries(CANONICAL_INTERVALS).map(([interval, information]) => [
    `${information.semitones}:${information.degree}`,
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    interval as CanonicalInterval,
  ]),
);

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
