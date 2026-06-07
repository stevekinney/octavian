/**
 * Just intonation ratio types and the canonical 5-limit major-scale catalog.
 *
 * Ratios are stored as integer numerator/denominator pairs so that exact
 * arithmetic (e.g. `justIntonationRatiosFor`) can be compared without
 * floating-point representation error.  Cent values are derived from the
 * ratio on demand via `ratioCents`.
 */

/**
 * An exact frequency ratio expressed as an integer numerator/denominator pair.
 */
export type Ratio = {
  readonly numerator: number;
  readonly denominator: number;
};

/**
 * Creates a {@link Ratio} from a numerator and denominator.
 *
 * @param numerator The ratio numerator. Must be a positive integer.
 * @param denominator The ratio denominator. Must be a positive integer.
 * @returns The ratio object.
 * @throws {RangeError} When either argument is not a positive integer.
 */
export function createRatio(numerator: number, denominator: number): Ratio {
  if (!Number.isInteger(numerator) || numerator <= 0) {
    throw new RangeError(`Expected a positive integer numerator, received ${numerator}.`);
  }

  if (!Number.isInteger(denominator) || denominator <= 0) {
    throw new RangeError(`Expected a positive integer denominator, received ${denominator}.`);
  }

  return { numerator, denominator };
}

/**
 * Returns the floating-point value of a ratio.
 *
 * @param ratio The ratio to evaluate.
 * @returns The decimal value of `numerator / denominator`.
 */
export function ratioValue(ratio: Ratio): number {
  return ratio.numerator / ratio.denominator;
}

/**
 * Returns the cent value of a ratio relative to unison.
 *
 * @param ratio The ratio to convert.
 * @returns Cents above unison (1200 * log2(numerator / denominator)).
 */
export function ratioCents(ratio: Ratio): number {
  return 1200 * Math.log2(ratio.numerator / ratio.denominator);
}

/**
 * The 5-limit just intonation major scale ratios relative to the tonic,
 * indexed by semitone offset from the tonic (0–11).
 *
 * Only the seven scale degrees of the major scale are defined.  Chromatic
 * semitones that are not part of the major scale are absent; accessing them
 * via {@link justRatioForSemitone} will throw a {@link TypeError}.
 *
 * Published values (standard 5-limit JI):
 * - 0  (unison)     1/1
 * - 2  (major 2nd)  9/8
 * - 4  (major 3rd)  5/4
 * - 5  (perfect 4th) 4/3
 * - 7  (perfect 5th) 3/2
 * - 9  (major 6th)  5/3
 * - 11 (major 7th)  15/8
 */
const JUST_MAJOR_RATIOS: Readonly<Record<number, Ratio>> = {
  0: { numerator: 1, denominator: 1 }, // unison    1/1
  2: { numerator: 9, denominator: 8 }, // M2        9/8
  4: { numerator: 5, denominator: 4 }, // M3        5/4
  5: { numerator: 4, denominator: 3 }, // P4        4/3
  7: { numerator: 3, denominator: 2 }, // P5        3/2
  9: { numerator: 5, denominator: 3 }, // M6        5/3
  11: { numerator: 15, denominator: 8 }, // M7      15/8
};

/**
 * The semitone offsets for the seven degrees of the major scale.
 * Order matches the JUST_MAJOR_RATIOS keys.
 */
const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

/**
 * The supported scale/mode names for {@link justIntonationRatiosFor}.
 * Only the major scale is included in v1; other modes have multiple
 * historical conventions and require explicit authorship.
 */
const SUPPORTED_JI_SCALES = new Set<string>(['major', 'ionian']);

/**
 * Returns the 5-limit just intonation ratio for a semitone offset within
 * the major scale.
 *
 * @param semitone The semitone offset from the tonic (0–11).
 * @returns The just intonation ratio.
 * @throws {TypeError} When the semitone offset is not a major-scale degree.
 */
export function justRatioForSemitone(semitone: number): Ratio {
  const ratio = JUST_MAJOR_RATIOS[semitone];

  if (!ratio) {
    throw new TypeError(
      `No 5-limit just intonation ratio defined for semitone offset ${semitone}. ` +
        `Only major-scale degrees (0,2,4,5,7,9,11) are supported.`,
    );
  }

  return ratio;
}

/**
 * Returns the ordered list of 5-limit just intonation ratios for the
 * major scale (or its modal alias `'ionian'`), relative to the tonic.
 *
 * The returned array corresponds to scale degrees 1–7:
 * `[1/1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8]`.
 *
 * @param scaleOrMode The scale type to look up. Currently only `'major'`
 *   and `'ionian'` are supported.
 * @returns The seven just intonation ratios in ascending scale order.
 * @throws {RangeError} When the scale type is not supported.
 */
export function justIntonationRatiosFor(scaleOrMode: string): readonly Ratio[] {
  if (!SUPPORTED_JI_SCALES.has(scaleOrMode)) {
    throw new RangeError(
      `Just intonation ratios are only defined for 'major' / 'ionian'. ` +
        `Received: '${scaleOrMode}'. Other modes have multiple historical ` +
        `conventions and are not included to avoid inventing ratios.`,
    );
  }

  return Object.freeze(
    MAJOR_SCALE_SEMITONES.map((semitone) => {
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      return JUST_MAJOR_RATIOS[semitone]!;
    }),
  );
}
