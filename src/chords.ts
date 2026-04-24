import type { NoteName } from './note-spellings.js';
import type { Interval } from './intervals.js';

/**
 * The supported chord symbols for display and parsing.
 */
export const CHORD_SYMBOLS = [
  '',
  'm',
  'dim',
  'aug',
  'sus2',
  'sus4',
  '6',
  'm6',
  '7',
  'maj7',
  'm7',
  'mMaj7',
  'dim7',
  'm7b5',
  '7#5',
  'maj7#5',
  '9',
  'maj9',
  'm9',
  '11',
  'maj11',
  'm11',
  '13',
  'maj13',
  'm13',
  'add9',
  'madd9',
  '6/9',
] as const;

/**
 * A supported chord symbol.
 */
export type ChordSymbol = (typeof CHORD_SYMBOLS)[number];

/**
 * Structured chord interval information.
 */
export type ChordInformation = {
  readonly symbol: ChordSymbol;
  readonly intervals: readonly Interval[];
};

const CANONICAL_CHORDS = {
  major: {
    symbol: '',
    intervals: ['perfectUnison', 'majorThird', 'perfectFifth'],
  },
  minor: {
    symbol: 'm',
    intervals: ['perfectUnison', 'minorThird', 'perfectFifth'],
  },
  diminished: {
    symbol: 'dim',
    intervals: ['perfectUnison', 'minorThird', 'diminishedFifth'],
  },
  augmented: {
    symbol: 'aug',
    intervals: ['perfectUnison', 'majorThird', 'augmentedFifth'],
  },
  suspendedSecond: {
    symbol: 'sus2',
    intervals: ['perfectUnison', 'majorSecond', 'perfectFifth'],
  },
  suspendedFourth: {
    symbol: 'sus4',
    intervals: ['perfectUnison', 'perfectFourth', 'perfectFifth'],
  },
  majorSixth: {
    symbol: '6',
    intervals: ['perfectUnison', 'majorThird', 'perfectFifth', 'majorSixth'],
  },
  minorSixth: {
    symbol: 'm6',
    intervals: ['perfectUnison', 'minorThird', 'perfectFifth', 'majorSixth'],
  },
  dominantSeventh: {
    symbol: '7',
    intervals: ['perfectUnison', 'majorThird', 'perfectFifth', 'minorSeventh'],
  },
  majorSeventh: {
    symbol: 'maj7',
    intervals: ['perfectUnison', 'majorThird', 'perfectFifth', 'majorSeventh'],
  },
  minorSeventh: {
    symbol: 'm7',
    intervals: ['perfectUnison', 'minorThird', 'perfectFifth', 'minorSeventh'],
  },
  minorMajorSeventh: {
    symbol: 'mMaj7',
    intervals: ['perfectUnison', 'minorThird', 'perfectFifth', 'majorSeventh'],
  },
  diminishedSeventh: {
    symbol: 'dim7',
    intervals: ['perfectUnison', 'minorThird', 'diminishedFifth', 'diminishedSeventh'],
  },
  halfDiminishedSeventh: {
    symbol: 'm7b5',
    intervals: ['perfectUnison', 'minorThird', 'diminishedFifth', 'minorSeventh'],
  },
  augmentedSeventh: {
    symbol: '7#5',
    intervals: ['perfectUnison', 'majorThird', 'augmentedFifth', 'minorSeventh'],
  },
  augmentedMajorSeventh: {
    symbol: 'maj7#5',
    intervals: ['perfectUnison', 'majorThird', 'augmentedFifth', 'majorSeventh'],
  },
  dominantNinth: {
    symbol: '9',
    intervals: ['perfectUnison', 'majorThird', 'perfectFifth', 'minorSeventh', 'majorNinth'],
  },
  majorNinth: {
    symbol: 'maj9',
    intervals: ['perfectUnison', 'majorThird', 'perfectFifth', 'majorSeventh', 'majorNinth'],
  },
  minorNinth: {
    symbol: 'm9',
    intervals: ['perfectUnison', 'minorThird', 'perfectFifth', 'minorSeventh', 'majorNinth'],
  },
  dominantEleventh: {
    symbol: '11',
    intervals: [
      'perfectUnison',
      'majorThird',
      'perfectFifth',
      'minorSeventh',
      'majorNinth',
      'perfectEleventh',
    ],
  },
  majorEleventh: {
    symbol: 'maj11',
    intervals: [
      'perfectUnison',
      'majorThird',
      'perfectFifth',
      'majorSeventh',
      'majorNinth',
      'perfectEleventh',
    ],
  },
  minorEleventh: {
    symbol: 'm11',
    intervals: [
      'perfectUnison',
      'minorThird',
      'perfectFifth',
      'minorSeventh',
      'majorNinth',
      'perfectEleventh',
    ],
  },
  dominantThirteenth: {
    symbol: '13',
    intervals: [
      'perfectUnison',
      'majorThird',
      'perfectFifth',
      'minorSeventh',
      'majorNinth',
      'perfectEleventh',
      'majorThirteenth',
    ],
  },
  majorThirteenth: {
    symbol: 'maj13',
    intervals: [
      'perfectUnison',
      'majorThird',
      'perfectFifth',
      'majorSeventh',
      'majorNinth',
      'perfectEleventh',
      'majorThirteenth',
    ],
  },
  minorThirteenth: {
    symbol: 'm13',
    intervals: [
      'perfectUnison',
      'minorThird',
      'perfectFifth',
      'minorSeventh',
      'majorNinth',
      'perfectEleventh',
      'majorThirteenth',
    ],
  },
  addNine: {
    symbol: 'add9',
    intervals: ['perfectUnison', 'majorThird', 'perfectFifth', 'majorNinth'],
  },
  minorAddNine: {
    symbol: 'madd9',
    intervals: ['perfectUnison', 'minorThird', 'perfectFifth', 'majorNinth'],
  },
  sixthAddNine: {
    symbol: '6/9',
    intervals: ['perfectUnison', 'majorThird', 'perfectFifth', 'majorSixth', 'majorNinth'],
  },
} as const satisfies Record<string, ChordInformation>;

const CHORD_ALIASES = {
  majorTriad: 'major',
  minorTriad: 'minor',
  diminishedTriad: 'diminished',
  augmentedTriad: 'augmented',
  sus2: 'suspendedSecond',
  sus4: 'suspendedFourth',
  six: 'majorSixth',
  minorSix: 'minorSixth',
  seven: 'dominantSeventh',
  maj7: 'majorSeventh',
  min7: 'minorSeventh',
  minorMaj7: 'minorMajorSeventh',
  minorSevenFlatFive: 'halfDiminishedSeventh',
  sevenSharpFive: 'augmentedSeventh',
  majorSevenSharpFive: 'augmentedMajorSeventh',
  nine: 'dominantNinth',
  maj9: 'majorNinth',
  min9: 'minorNinth',
  eleven: 'dominantEleventh',
  maj11: 'majorEleventh',
  min11: 'minorEleventh',
  thirteen: 'dominantThirteenth',
  maj13: 'majorThirteenth',
  min13: 'minorThirteenth',
  majorAddNine: 'addNine',
  sixNine: 'sixthAddNine',
} as const satisfies Record<string, keyof typeof CANONICAL_CHORDS>;

/**
 * The canonical chord suffixes used for computed chord output.
 */
export type CanonicalChordSuffix = keyof typeof CANONICAL_CHORDS;

/**
 * Every accepted chord suffix, including aliases.
 */
export type ChordSuffix = CanonicalChordSuffix | keyof typeof CHORD_ALIASES;

/**
 * A spelled chord name without a slash bass note.
 */
export type ChordName = `${NoteName}${ChordSymbol}`;

/**
 * A slash chord display name.
 */
export type SlashChordName = `${ChordName}/${NoteName}`;

/**
 * The display name for a chord.
 */
export type ChordDisplayName = ChordName | SlashChordName;

/**
 * A high-level chord quality classification.
 */
export type ChordQuality =
  | 'major'
  | 'minor'
  | 'diminished'
  | 'augmented'
  | 'dominant'
  | 'suspended'
  | 'altered';

/**
 * The supported chord degrees that can be queried directly.
 */
export type ChordDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 9 | 11 | 13;

/**
 * Supported inversion counts for the chord catalog in this package.
 */
export type InversionCount = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Supported tertian chord structures derived from scales.
 */
export type ChordType = 'triad' | 'seventh' | 'ninth' | 'eleventh' | 'thirteenth';

/**
 * Supported chord voicing strategies.
 */
export type VoicingStrategy = 'close' | 'open' | 'lowerSecondFromTop' | 'lowerThirdFromTop';

/**
 * Structured chord definitions, including accepted aliases.
 */
export const CHORDS = Object.freeze({
  ...CANONICAL_CHORDS,
  majorTriad: CANONICAL_CHORDS.major,
  minorTriad: CANONICAL_CHORDS.minor,
  diminishedTriad: CANONICAL_CHORDS.diminished,
  augmentedTriad: CANONICAL_CHORDS.augmented,
  sus2: CANONICAL_CHORDS.suspendedSecond,
  sus4: CANONICAL_CHORDS.suspendedFourth,
  six: CANONICAL_CHORDS.majorSixth,
  minorSix: CANONICAL_CHORDS.minorSixth,
  seven: CANONICAL_CHORDS.dominantSeventh,
  maj7: CANONICAL_CHORDS.majorSeventh,
  min7: CANONICAL_CHORDS.minorSeventh,
  minorMaj7: CANONICAL_CHORDS.minorMajorSeventh,
  minorSevenFlatFive: CANONICAL_CHORDS.halfDiminishedSeventh,
  sevenSharpFive: CANONICAL_CHORDS.augmentedSeventh,
  majorSevenSharpFive: CANONICAL_CHORDS.augmentedMajorSeventh,
  nine: CANONICAL_CHORDS.dominantNinth,
  maj9: CANONICAL_CHORDS.majorNinth,
  min9: CANONICAL_CHORDS.minorNinth,
  eleven: CANONICAL_CHORDS.dominantEleventh,
  maj11: CANONICAL_CHORDS.majorEleventh,
  min11: CANONICAL_CHORDS.minorEleventh,
  thirteen: CANONICAL_CHORDS.dominantThirteenth,
  maj13: CANONICAL_CHORDS.majorThirteenth,
  min13: CANONICAL_CHORDS.minorThirteenth,
  majorAddNine: CANONICAL_CHORDS.addNine,
  sixNine: CANONICAL_CHORDS.sixthAddNine,
}) satisfies Readonly<Record<ChordSuffix, ChordInformation>>;

const CHORD_SYMBOL_TO_SUFFIX = new Map<ChordSymbol, CanonicalChordSuffix>(
  Object.entries(CANONICAL_CHORDS).map(([suffix, information]) => [
    information.symbol,
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    suffix as CanonicalChordSuffix,
  ]),
);

const CHORD_INTERVAL_LOOKUP = new Map<string, CanonicalChordSuffix>(
  Object.entries(CANONICAL_CHORDS).map(([suffix, information]) => [
    information.intervals.join('|'),
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    suffix as CanonicalChordSuffix,
  ]),
);

const CHORD_QUALITY_BY_SUFFIX = {
  major: 'major',
  majorSixth: 'major',
  majorSeventh: 'major',
  majorNinth: 'major',
  majorEleventh: 'major',
  majorThirteenth: 'major',
  addNine: 'major',
  sixthAddNine: 'major',
  minor: 'minor',
  minorSixth: 'minor',
  minorSeventh: 'minor',
  minorMajorSeventh: 'minor',
  minorNinth: 'minor',
  minorEleventh: 'minor',
  minorThirteenth: 'minor',
  minorAddNine: 'minor',
  diminished: 'diminished',
  diminishedSeventh: 'diminished',
  halfDiminishedSeventh: 'diminished',
  augmented: 'augmented',
  augmentedSeventh: 'augmented',
  augmentedMajorSeventh: 'augmented',
  suspendedSecond: 'suspended',
  suspendedFourth: 'suspended',
  dominantSeventh: 'dominant',
  dominantNinth: 'dominant',
  dominantEleventh: 'dominant',
  dominantThirteenth: 'dominant',
} as const satisfies Record<CanonicalChordSuffix, ChordQuality>;

/**
 * Resolves a chord suffix or symbol to its canonical chord suffix.
 *
 * @param input The chord suffix or chord symbol to resolve.
 * @returns The canonical chord suffix.
 * @throws {TypeError} When the input is not a known suffix or symbol.
 */
export function resolveChordSuffix(input: ChordSuffix | ChordSymbol): CanonicalChordSuffix {
  if (input in CANONICAL_CHORDS) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return input as CanonicalChordSuffix;
  }

  if (input in CHORD_ALIASES) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return CHORD_ALIASES[input as keyof typeof CHORD_ALIASES];
  }

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  const symbolMatch = CHORD_SYMBOL_TO_SUFFIX.get(input as ChordSymbol);
  if (symbolMatch) {
    return symbolMatch;
  }

  throw new TypeError(`Unsupported chord suffix or symbol: ${input}.`);
}

/**
 * Infers a canonical chord suffix from a normalized interval collection.
 *
 * @param intervals The interval collection to inspect.
 * @returns The matching canonical chord suffix, or `null` when there is no catalog match.
 */
export function findChordSuffixByIntervals(
  intervals: readonly Interval[],
): CanonicalChordSuffix | null {
  return CHORD_INTERVAL_LOOKUP.get(intervals.join('|')) ?? null;
}

/**
 * Maps a canonical chord suffix to a broad chord quality.
 *
 * @param suffix The canonical chord suffix to classify.
 * @returns The broad chord quality.
 */
export function chordQualityForSuffix(suffix: CanonicalChordSuffix): ChordQuality {
  return CHORD_QUALITY_BY_SUFFIX[suffix];
}
