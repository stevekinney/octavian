import type { Interval } from './intervals.js';
import type {
  CanonicalChordSuffix,
  ChordSymbol,
  ChordSuffix,
  ChordQuality,
} from './chord-catalog-types.js';
import { CANONICAL_CHORDS, CHORD_ALIASES, CHORD_QUALITY_BY_SUFFIX } from './chord-catalog-data.js';
export { CHORDS } from './chord-catalog-data.js';
export { CHORD_SYMBOLS } from './chord-catalog-types.js';
export type {
  CanonicalChordSuffix,
  ChordAliasKey,
  ChordInformation,
  ChordSymbol,
  ChordSuffix,
  ChordName,
  SlashChordName,
  ChordDisplayName,
  ChordQuality,
  ChordDegree,
  InversionCount,
  ChordType,
  VoicingStrategy,
} from './chord-catalog-types.js';
export { createChordName, createSlashChordName } from './chord-catalog-types.js';

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

/** Resolves a chord suffix or symbol to its canonical chord suffix. */
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
  if (symbolMatch) return symbolMatch;
  throw new TypeError(`Unsupported chord suffix or symbol: ${input}.`);
}

/** Infers a canonical chord suffix from a normalized interval collection. */
export function findChordSuffixByIntervals(
  intervals: readonly Interval[],
): CanonicalChordSuffix | null {
  return CHORD_INTERVAL_LOOKUP.get(intervals.join('|')) ?? null;
}

/** Maps a canonical chord suffix to a broad chord quality. */
export function chordQualityForSuffix(suffix: CanonicalChordSuffix): ChordQuality {
  return CHORD_QUALITY_BY_SUFFIX[suffix];
}
