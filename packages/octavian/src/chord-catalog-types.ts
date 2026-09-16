import type { Brand } from './branded-types.js';
import type { Interval } from './intervals.js';

export const CHORD_SYMBOLS = [
  '',
  'm',
  'dim',
  'aug',
  '5',
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
  '7sus2',
  '7sus4',
  '7sus',
  '7♭9',
  '7b9',
  '7♯9',
  '7#9',
  '7♭5',
  '7b5',
  '7♯5',
  '7#5',
  '7♯11',
  '7#11',
  '7♭13',
  '7b13',
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

export type ChordSymbol = (typeof CHORD_SYMBOLS)[number];
export type ChordInformation = {
  readonly symbol: ChordSymbol;
  readonly intervals: readonly Interval[];
};

export type CanonicalChordSuffix =
  | 'major'
  | 'minor'
  | 'diminished'
  | 'augmented'
  | 'power'
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
  | 'dominantSeventhSuspendedSecond'
  | 'dominantSeventhSuspendedFourth'
  | 'dominantSevenFlatNine'
  | 'dominantSevenSharpNine'
  | 'dominantSevenFlatFive'
  | 'dominantSevenSharpFive'
  | 'dominantSevenSharpEleven'
  | 'dominantSevenFlatThirteen'
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

export type ChordAliasKey =
  | 'majorTriad'
  | 'minorTriad'
  | 'diminishedTriad'
  | 'augmentedTriad'
  | 'powerChord'
  | 'sus2'
  | 'sus4'
  | 'six'
  | 'minorSix'
  | 'seven'
  | 'maj7'
  | 'min7'
  | 'minorMaj7'
  | 'minorSevenFlatFive'
  | 'dominantSeventhSuspendedSecond'
  | 'dominantSeventhSuspendedFourth'
  | '7sus'
  | 'sevenFlatNine'
  | '7b9'
  | 'sevenSharpNine'
  | '7#9'
  | 'sevenFlatFive'
  | '7b5'
  | 'sevenSharpFive'
  | '7#5'
  | 'sevenSharpEleven'
  | '7#11'
  | 'sevenFlatThirteen'
  | '7b13'
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

export type ChordSuffix = CanonicalChordSuffix | ChordAliasKey;
export type ChordName = Brand<string, 'ChordName'>;
export type SlashChordName = Brand<string, 'SlashChordName'>;
export type ChordDisplayName = ChordName | SlashChordName;
export type ChordQuality =
  'major' | 'minor' | 'diminished' | 'augmented' | 'power' | 'dominant' | 'suspended' | 'altered';
export type ChordDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 9 | 11 | 13;
export type InversionCount = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type ChordType = 'triad' | 'seventh' | 'ninth' | 'eleventh' | 'thirteenth';
export type VoicingStrategy = 'close' | 'open' | 'lowerSecondFromTop' | 'lowerThirdFromTop';

export function createChordName(value: string): ChordName {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return value as ChordName;
}

export function createSlashChordName(value: string): SlashChordName {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return value as SlashChordName;
}
