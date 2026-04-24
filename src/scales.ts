import type { Interval } from './intervals.js';

/**
 * The supported named modes of the diatonic scale family.
 */
export type ModeName =
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian';

/**
 * The seven traditional scale degrees.
 */
export type ScaleDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Extended scale degrees used by tertian harmony.
 */
export type ExtendedScaleDegree = ScaleDegree | 9 | 11 | 13;

/**
 * Structured scale interval information.
 */
export type ScaleInformation = {
  readonly intervals: readonly Interval[];
  readonly degrees: readonly number[];
  readonly aliases?: readonly string[];
};

/**
 * The canonical scale names used for computed scale output.
 */
export type CanonicalScaleType =
  | 'major'
  | 'naturalMinor'
  | 'harmonicMinor'
  | 'melodicMinor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'locrian'
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'blues'
  | 'chromatic'
  | 'wholeTone'
  | 'diminished'
  | 'halfWholeDiminished';

/**
 * The accepted scale alias names.
 */
type ScaleAliasKey =
  | 'ionian'
  | 'minor'
  | 'aeolian'
  | 'pentatonicMajor'
  | 'pentatonicMinor'
  | 'minorBlues'
  | 'octatonic'
  | 'wholeHalfDiminished';

/**
 * Every accepted scale name, including aliases.
 */
export type ScaleType = CanonicalScaleType | ScaleAliasKey;

const CANONICAL_SCALES: Record<CanonicalScaleType, Omit<ScaleInformation, 'degrees'>> = {
  major: {
    intervals: [
      'perfectUnison',
      'majorSecond',
      'majorThird',
      'perfectFourth',
      'perfectFifth',
      'majorSixth',
      'majorSeventh',
    ],
  },
  naturalMinor: {
    intervals: [
      'perfectUnison',
      'majorSecond',
      'minorThird',
      'perfectFourth',
      'perfectFifth',
      'minorSixth',
      'minorSeventh',
    ],
  },
  harmonicMinor: {
    intervals: [
      'perfectUnison',
      'majorSecond',
      'minorThird',
      'perfectFourth',
      'perfectFifth',
      'minorSixth',
      'majorSeventh',
    ],
  },
  melodicMinor: {
    intervals: [
      'perfectUnison',
      'majorSecond',
      'minorThird',
      'perfectFourth',
      'perfectFifth',
      'majorSixth',
      'majorSeventh',
    ],
  },
  dorian: {
    intervals: [
      'perfectUnison',
      'majorSecond',
      'minorThird',
      'perfectFourth',
      'perfectFifth',
      'majorSixth',
      'minorSeventh',
    ],
  },
  phrygian: {
    intervals: [
      'perfectUnison',
      'minorSecond',
      'minorThird',
      'perfectFourth',
      'perfectFifth',
      'minorSixth',
      'minorSeventh',
    ],
  },
  lydian: {
    intervals: [
      'perfectUnison',
      'majorSecond',
      'majorThird',
      'augmentedFourth',
      'perfectFifth',
      'majorSixth',
      'majorSeventh',
    ],
  },
  mixolydian: {
    intervals: [
      'perfectUnison',
      'majorSecond',
      'majorThird',
      'perfectFourth',
      'perfectFifth',
      'majorSixth',
      'minorSeventh',
    ],
  },
  locrian: {
    intervals: [
      'perfectUnison',
      'minorSecond',
      'minorThird',
      'perfectFourth',
      'diminishedFifth',
      'minorSixth',
      'minorSeventh',
    ],
  },
  majorPentatonic: {
    intervals: ['perfectUnison', 'majorSecond', 'majorThird', 'perfectFifth', 'majorSixth'],
  },
  minorPentatonic: {
    intervals: ['perfectUnison', 'minorThird', 'perfectFourth', 'perfectFifth', 'minorSeventh'],
  },
  blues: {
    intervals: [
      'perfectUnison',
      'minorThird',
      'perfectFourth',
      'diminishedFifth',
      'perfectFifth',
      'minorSeventh',
    ],
  },
  chromatic: {
    intervals: [
      'perfectUnison',
      'minorSecond',
      'majorSecond',
      'minorThird',
      'majorThird',
      'perfectFourth',
      'augmentedFourth',
      'perfectFifth',
      'minorSixth',
      'majorSixth',
      'minorSeventh',
      'majorSeventh',
    ],
  },
  wholeTone: {
    intervals: [
      'perfectUnison',
      'majorSecond',
      'majorThird',
      'augmentedFourth',
      'augmentedFifth',
      'minorSeventh',
    ],
  },
  diminished: {
    intervals: [
      'perfectUnison',
      'majorSecond',
      'minorThird',
      'perfectFourth',
      'diminishedFifth',
      'minorSixth',
      'majorSixth',
      'majorSeventh',
    ],
  },
  halfWholeDiminished: {
    intervals: [
      'perfectUnison',
      'minorSecond',
      'minorThird',
      'majorThird',
      'diminishedFifth',
      'perfectFifth',
      'majorSixth',
      'minorSeventh',
    ],
  },
} satisfies Record<CanonicalScaleType, Omit<ScaleInformation, 'degrees'>>;

/**
 * Named scale definitions, including accepted aliases.
 */
export const SCALES: Readonly<Record<ScaleType, ScaleInformation>> = Object.freeze({
  major: {
    ...CANONICAL_SCALES.major,
    degrees: [1, 2, 3, 4, 5, 6, 7],
    aliases: ['ionian'],
  },
  naturalMinor: {
    ...CANONICAL_SCALES.naturalMinor,
    degrees: [1, 2, 3, 4, 5, 6, 7],
    aliases: ['minor', 'aeolian'],
  },
  harmonicMinor: {
    ...CANONICAL_SCALES.harmonicMinor,
    degrees: [1, 2, 3, 4, 5, 6, 7],
    aliases: [],
  },
  melodicMinor: {
    ...CANONICAL_SCALES.melodicMinor,
    degrees: [1, 2, 3, 4, 5, 6, 7],
    aliases: [],
  },
  dorian: {
    ...CANONICAL_SCALES.dorian,
    degrees: [1, 2, 3, 4, 5, 6, 7],
    aliases: [],
  },
  phrygian: {
    ...CANONICAL_SCALES.phrygian,
    degrees: [1, 2, 3, 4, 5, 6, 7],
    aliases: [],
  },
  lydian: {
    ...CANONICAL_SCALES.lydian,
    degrees: [1, 2, 3, 4, 5, 6, 7],
    aliases: [],
  },
  mixolydian: {
    ...CANONICAL_SCALES.mixolydian,
    degrees: [1, 2, 3, 4, 5, 6, 7],
    aliases: [],
  },
  locrian: {
    ...CANONICAL_SCALES.locrian,
    degrees: [1, 2, 3, 4, 5, 6, 7],
    aliases: [],
  },
  majorPentatonic: {
    ...CANONICAL_SCALES.majorPentatonic,
    degrees: [1, 2, 3, 4, 5],
    aliases: ['pentatonicMajor'],
  },
  minorPentatonic: {
    ...CANONICAL_SCALES.minorPentatonic,
    degrees: [1, 2, 3, 4, 5],
    aliases: ['pentatonicMinor'],
  },
  blues: {
    ...CANONICAL_SCALES.blues,
    degrees: [1, 2, 3, 4, 5, 6],
    aliases: ['minorBlues'],
  },
  chromatic: {
    ...CANONICAL_SCALES.chromatic,
    degrees: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    aliases: [],
  },
  wholeTone: {
    ...CANONICAL_SCALES.wholeTone,
    degrees: [1, 2, 3, 4, 5, 6],
    aliases: [],
  },
  diminished: {
    ...CANONICAL_SCALES.diminished,
    degrees: [1, 2, 3, 4, 5, 6, 7, 8],
    aliases: ['octatonic', 'wholeHalfDiminished'],
  },
  halfWholeDiminished: {
    ...CANONICAL_SCALES.halfWholeDiminished,
    degrees: [1, 2, 3, 4, 5, 6, 7, 8],
    aliases: [],
  },
  ionian: {
    ...CANONICAL_SCALES.major,
    degrees: [1, 2, 3, 4, 5, 6, 7],
    aliases: ['major'],
  },
  minor: {
    ...CANONICAL_SCALES.naturalMinor,
    degrees: [1, 2, 3, 4, 5, 6, 7],
    aliases: ['naturalMinor'],
  },
  aeolian: {
    ...CANONICAL_SCALES.naturalMinor,
    degrees: [1, 2, 3, 4, 5, 6, 7],
    aliases: ['naturalMinor'],
  },
  pentatonicMajor: {
    ...CANONICAL_SCALES.majorPentatonic,
    degrees: [1, 2, 3, 4, 5],
    aliases: ['majorPentatonic'],
  },
  pentatonicMinor: {
    ...CANONICAL_SCALES.minorPentatonic,
    degrees: [1, 2, 3, 4, 5],
    aliases: ['minorPentatonic'],
  },
  minorBlues: {
    ...CANONICAL_SCALES.blues,
    degrees: [1, 2, 3, 4, 5, 6],
    aliases: ['blues'],
  },
  octatonic: {
    ...CANONICAL_SCALES.diminished,
    degrees: [1, 2, 3, 4, 5, 6, 7, 8],
    aliases: ['diminished'],
  },
  wholeHalfDiminished: {
    ...CANONICAL_SCALES.diminished,
    degrees: [1, 2, 3, 4, 5, 6, 7, 8],
    aliases: ['diminished'],
  },
});

const MODE_TO_SCALE_TYPE: Record<ModeName, CanonicalScaleType> = {
  ionian: 'major',
  dorian: 'dorian',
  phrygian: 'phrygian',
  lydian: 'lydian',
  mixolydian: 'mixolydian',
  aeolian: 'naturalMinor',
  locrian: 'locrian',
} satisfies Record<ModeName, CanonicalScaleType>;

/**
 * Resolves a scale name or alias to its canonical scale name.
 *
 * @param type The scale name to resolve.
 * @returns The canonical scale name.
 */
export function resolveScaleType(type: ScaleType): CanonicalScaleType {
  switch (type) {
    case 'ionian':
      return 'major';
    case 'minor':
    case 'aeolian':
      return 'naturalMinor';
    case 'pentatonicMajor':
      return 'majorPentatonic';
    case 'pentatonicMinor':
      return 'minorPentatonic';
    case 'minorBlues':
      return 'blues';
    case 'octatonic':
    case 'wholeHalfDiminished':
      return 'diminished';
    default:
      return type;
  }
}

/**
 * Resolves a mode name to the canonical scale type used by this package.
 *
 * @param mode The mode name to resolve.
 * @returns The canonical scale type for that mode.
 */
export function scaleTypeForMode(mode: ModeName): CanonicalScaleType {
  return MODE_TO_SCALE_TYPE[mode];
}

/**
 * Returns `true` when the given scale type is part of the seven-note diatonic mode family.
 *
 * @param type The scale type to inspect.
 * @returns `true` when the scale belongs to the diatonic mode family.
 */
export function isDiatonicModeFamily(type: CanonicalScaleType): boolean {
  return (
    type === 'major' ||
    type === 'naturalMinor' ||
    type === 'dorian' ||
    type === 'phrygian' ||
    type === 'lydian' ||
    type === 'mixolydian' ||
    type === 'locrian'
  );
}
