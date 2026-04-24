import type { Brand } from './branded-types.js';
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

/**
 * The canonical chord suffix names used for computed chord output.
 */
export type CanonicalChordSuffix =
  | 'major'
  | 'minor'
  | 'diminished'
  | 'augmented'
  | 'suspendedSecond'
  | 'suspendedFourth'
  | 'majorSixth'
  | 'minorSixth'
  | 'dominantSeventh'
  | 'majorSeventh'
  | 'minorSeventh'
  | 'minorMajorSeventh'
  | 'diminishedSeventh'
  | 'halfDiminishedSeventh'
  | 'augmentedSeventh'
  | 'augmentedMajorSeventh'
  | 'dominantNinth'
  | 'majorNinth'
  | 'minorNinth'
  | 'dominantEleventh'
  | 'majorEleventh'
  | 'minorEleventh'
  | 'dominantThirteenth'
  | 'majorThirteenth'
  | 'minorThirteenth'
  | 'addNine'
  | 'minorAddNine'
  | 'sixthAddNine';

/**
 * The accepted chord alias suffix names.
 */
type ChordAliasKey =
  | 'majorTriad'
  | 'minorTriad'
  | 'diminishedTriad'
  | 'augmentedTriad'
  | 'sus2'
  | 'sus4'
  | 'six'
  | 'minorSix'
  | 'seven'
  | 'maj7'
  | 'min7'
  | 'minorMaj7'
  | 'minorSevenFlatFive'
  | 'sevenSharpFive'
  | 'majorSevenSharpFive'
  | 'nine'
  | 'maj9'
  | 'min9'
  | 'eleven'
  | 'maj11'
  | 'min11'
  | 'thirteen'
  | 'maj13'
  | 'min13'
  | 'majorAddNine'
  | 'sixNine';

/**
 * Every accepted chord suffix, including aliases.
 */
export type ChordSuffix = CanonicalChordSuffix | ChordAliasKey;

/** A validated chord name string, e.g. "Cmaj7" or "C". */
export type ChordName = Brand<string, 'ChordName'>;

/** A validated slash-chord name string, e.g. "Cmaj7/E". */
export type SlashChordName = Brand<string, 'SlashChordName'>;

/**
 * The display name for a chord.
 */
export type ChordDisplayName = ChordName | SlashChordName;

/**
 * Creates a validated chord name brand.
 *
 * @param value The chord name string.
 * @returns The branded chord name.
 */
export function createChordName(value: string): ChordName {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return value as ChordName;
}

/**
 * Creates a validated slash chord name brand.
 *
 * @param value The slash chord name string.
 * @returns The branded slash chord name.
 */
export function createSlashChordName(value: string): SlashChordName {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return value as SlashChordName;
}

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

const CANONICAL_CHORDS: Record<CanonicalChordSuffix, ChordInformation> = {
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
} satisfies Record<CanonicalChordSuffix, ChordInformation>;

const CHORD_ALIASES: Record<ChordAliasKey, CanonicalChordSuffix> = {
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
} satisfies Record<ChordAliasKey, CanonicalChordSuffix>;

/**
 * Structured chord definitions, including accepted aliases.
 */
export const CHORDS: Readonly<Record<ChordSuffix, ChordInformation>> = Object.freeze({
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
});

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

const CHORD_QUALITY_BY_SUFFIX: Record<CanonicalChordSuffix, ChordQuality> = {
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
} satisfies Record<CanonicalChordSuffix, ChordQuality>;

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
    return CHORD_ALIASES[input as ChordAliasKey];
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
