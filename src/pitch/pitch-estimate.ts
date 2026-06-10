/**
 * Pitch-estimate scoring helpers for Octavian.
 *
 * This module provides a pure scoring layer over an application-provided pitch
 * estimate (e.g. from a tuner or pitch-detection algorithm). It does NOT
 * perform pitch detection or open any microphone — the caller supplies the
 * raw estimate.
 *
 * Import as `octavian/pitch` (subpath export — not part of the root barrel).
 */

import { centsBetween } from '../temperament.js';
import { Note, noteToFrequency, type NoteLike } from '../note.js';
import { STANDARD_TUNING, type Tuning } from '../tuning.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A raw pitch estimate provided by an external pitch-detection algorithm.
 *
 * Only `frequency` is required and consumed by {@link evaluatePitchEstimate}.
 */
export type PitchEstimate = {
  /** The estimated fundamental frequency in hertz. Must be positive and finite. */
  readonly frequency: number;
};

/**
 * The result of evaluating a {@link PitchEstimate} against a target note.
 */
export type PitchEvaluation = {
  /**
   * The equal-tempered note whose frequency is closest to the estimate.
   * Resolved under the `tuning` option if provided.
   */
  readonly nearestNote: Note;
  /**
   * Signed cents from the target note's frequency to the estimate's frequency.
   *
   * Positive = estimate is sharp (above target).
   * Negative = estimate is flat (below target).
   * Range is unbounded — octave errors produce values around ±1200.
   */
  readonly centsError: number;
  /**
   * `true` when the nearest note shares the same pitch class (chromatic index)
   * as the target note, regardless of octave.
   */
  readonly pitchClassMatches: boolean;
  /**
   * `true` when the nearest note is the same pitch class **and** the same
   * octave as the target note.
   */
  readonly registerMatches: boolean;
  /**
   * `true` when the pitch class matches but the octave does not — the player
   * is singing/playing the right note name in the wrong octave.
   */
  readonly likelyOctaveError: boolean;
  /**
   * `true` when the estimate is within the `centsTolerance` of the target.
   *
   * In default register mode: requires `registerMatches` to be `true` and
   * `|centsError| <= centsTolerance`.
   *
   * In `pitchClassOnly` mode: the cents error is folded into the range
   * [−600, 600] (ignoring octave displacement) and `|foldedCents| <= centsTolerance`.
   */
  readonly withinTolerance: boolean;
};

/**
 * Options for {@link evaluatePitchEstimate}.
 */
export type EvaluatePitchEstimateOptions = {
  /**
   * The A4 reference frequency to use when resolving the target note's
   * frequency and the nearest note.  Defaults to standard tuning (A4 = 440 Hz).
   */
  readonly tuning?: Tuning;
  /**
   * The maximum absolute cents deviation considered "in tune".
   * Defaults to 50 cents (one quarter-tone).
   */
  readonly centsTolerance?: number;
  /**
   * When `true`, {@link PitchEvaluation.withinTolerance} ignores octave and
   * only checks whether the estimate's cents error, folded into a single
   * octave (±600 cents), is within `centsTolerance`.
   *
   * Useful for melodic exercises where the correct octave is optional.
   */
  readonly pitchClassOnly?: boolean;
};

// ---------------------------------------------------------------------------
// Helper: fold cents into (−600, 600] pitch-class space
// ---------------------------------------------------------------------------

/**
 * Folds an unbounded cents value into (−600, 600] — a single octave centred
 * on zero.  Used for pitch-class-only tolerance checking.
 *
 * @param cents The raw cents error (can be any finite number).
 * @returns The folded value in (−600, 600].
 */
function foldCentsIntoPitchClass(cents: number): number {
  // Normalise to [0, 1200) then shift to (−600, 600].
  const mod = ((cents % 1200) + 1200) % 1200;

  return mod > 600 ? mod - 1200 : mod;
}

// ---------------------------------------------------------------------------
// Helper: compute withinTolerance
// ---------------------------------------------------------------------------

/**
 * Computes whether a cents error is within the given tolerance, using either
 * register mode (exact pitch + octave match required) or pitch-class-only mode
 * (octave ignored, cents folded into one octave).
 */
function computeWithinTolerance(
  centsError: number,
  registerMatches: boolean,
  centsTolerance: number,
  pitchClassOnly: boolean,
): boolean {
  if (pitchClassOnly) {
    return Math.abs(foldCentsIntoPitchClass(centsError)) <= centsTolerance;
  }

  return registerMatches && Math.abs(centsError) <= centsTolerance;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Evaluates a raw pitch estimate against a target note, returning a detailed
 * scoring breakdown.
 *
 * The `estimate.frequency` is compared to the equal-tempered frequency of
 * `target` (under the provided `tuning`, defaulting to A4 = 440 Hz).
 *
 * Sign convention: `centsError` is positive when the estimate is **sharp**
 * (above the target) and negative when **flat**.
 *
 * @param estimate The raw pitch estimate from a pitch-detection algorithm.
 * @param target The target note the performer is supposed to be playing.
 * @param options Optional scoring options (tuning, tolerance, pitchClassOnly).
 * @returns A {@link PitchEvaluation} with the full scoring breakdown.
 * @throws {RangeError} When `estimate.frequency` is not a positive finite
 *   number (propagated from the underlying frequency utilities).
 * @throws {RangeError} When `options.centsTolerance` is not a finite
 *   non-negative number.
 * @throws {TypeError} When `target` is not a valid note-like value.
 */
export function evaluatePitchEstimate(
  estimate: PitchEstimate,
  target: NoteLike,
  options: EvaluatePitchEstimateOptions = {},
): PitchEvaluation {
  const { tuning = STANDARD_TUNING, centsTolerance = 50, pitchClassOnly = false } = options;

  if (!Number.isFinite(centsTolerance) || centsTolerance < 0) {
    throw new RangeError(
      `Expected a finite non-negative centsTolerance, received ${centsTolerance}.`,
    );
  }

  // Resolve target note and compute its frequency under the requested tuning.
  const targetNote = Note.create(target);
  const targetFrequency = Number(noteToFrequency(targetNote, tuning));

  // Find the equal-tempered note nearest to the estimate under the same tuning.
  const nearestNote = Note.nearestTo(estimate.frequency, tuning);

  // centsError: positive = estimate is sharp (above target).
  // centsBetween(a, b) = 1200 * log2(b/a), positive when b > a.
  // So centsBetween(targetFrequency, estimateFrequency) is positive when
  // estimate > target, matching the "positive = sharp" convention.
  const centsError = centsBetween(targetFrequency, estimate.frequency);

  // Pitch-class comparison (octave-invariant).
  const pitchClassMatches = nearestNote.chromaticIndex === targetNote.chromaticIndex;

  // Register match requires both pitch class and octave to agree.
  const registerMatches =
    pitchClassMatches && Number(nearestNote.octave) === Number(targetNote.octave);

  // Octave error: right pitch class, wrong octave.
  const likelyOctaveError = pitchClassMatches && !registerMatches;

  // Tolerance check.
  const withinTolerance = computeWithinTolerance(
    centsError,
    registerMatches,
    centsTolerance,
    pitchClassOnly,
  );

  return {
    nearestNote,
    centsError,
    pitchClassMatches,
    registerMatches,
    likelyOctaveError,
    withinTolerance,
  };
}
