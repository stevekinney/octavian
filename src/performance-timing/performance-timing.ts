/**
 * Performance timing analysis: quantization, comparison, and tempo estimation.
 *
 * All functions are pure computations over numbers / {@link PerformedEvent}
 * arrays. No I/O, no timers, no onset detection.
 *
 * Conventions
 * -----------
 * - "error" always means `performedOnset − expectedOnset` (positive ⇒ late).
 * - `latencyOffsetSeconds` is SUBTRACTED from performed onsets before any
 *   comparison (corrects for known input-device delay).
 * - Quantized deviations are preserved, not discarded (humanized timing).
 */

import type { Sequence } from '../sequences/sequence.js';
import type {
  PerformedEvent,
  QuantizedPerformance,
  QuantizedEvent,
  TimingComparison,
  TimingEvent,
  MissedTimingEvent,
  ExtraTimingEvent,
  TimingErrorClass,
  CompareTimingOptions,
  TempoEstimate,
  EstimateTempoOptions,
  MeasureSwingOptions,
} from './types.js';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function requireFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite positive number, received ${value}.`);
  }
}

function requireFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number, received ${value}.`);
  }
}

function requireFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number, received ${value}.`);
  }
}

// ---------------------------------------------------------------------------
// quantizePerformance
// ---------------------------------------------------------------------------

/**
 * Options for {@link quantizePerformance}.
 */
export type QuantizeOptions = {
  /**
   * A signed offset (in seconds) to apply before snapping to the grid.
   * Useful for swing or global latency correction at the quantization step.
   * Default `0`.
   */
  readonly offsetSeconds?: number;
};

/**
 * Snaps each performed onset to the nearest multiple of `gridSeconds`,
 * preserving the signed humanized-timing deviation as
 * `originalOnsetSeconds − quantizedOnsetSeconds`.
 *
 * A swing/latency `offsetSeconds` shifts all onsets before grid-snapping
 * (e.g. `−0.01` pulls a performer's notes slightly earlier on the grid).
 * The offset is recorded in the returned {@link QuantizedPerformance}.
 *
 * @param events The performed events to quantize.
 * @param gridSeconds The grid interval in seconds (must be finite and positive).
 * @param options Optional offset.
 * @returns The quantized performance with per-event deviations.
 * @throws {RangeError} When `gridSeconds` is not a finite positive number.
 * @throws {RangeError} When any onset is not a finite number.
 */
export function quantizePerformance(
  events: readonly PerformedEvent[],
  gridSeconds: number,
  options?: QuantizeOptions,
): QuantizedPerformance {
  requireFinitePositive(gridSeconds, 'gridSeconds');

  const offset = options?.offsetSeconds ?? 0;
  requireFinite(offset, 'offsetSeconds');

  const quantizedEvents: QuantizedEvent[] = events.map((event) => {
    requireFinite(event.onsetSeconds, 'onsetSeconds');

    const shifted = event.onsetSeconds + offset;
    const quantized = Math.round(shifted / gridSeconds) * gridSeconds;
    const deviation = event.onsetSeconds - quantized;

    let result: QuantizedEvent = {
      originalOnsetSeconds: event.onsetSeconds,
      quantizedOnsetSeconds: quantized,
      deviationSeconds: deviation,
    };

    if (event.durationSeconds !== undefined) {
      result = { ...result, durationSeconds: event.durationSeconds };
    }

    if (event.note !== undefined) {
      result = { ...result, note: event.note };
    }

    if (event.velocity !== undefined) {
      result = { ...result, velocity: event.velocity };
    }

    return result;
  });

  return {
    gridSeconds,
    offsetSeconds: offset,
    events: Object.freeze(quantizedEvents),
  };
}

// ---------------------------------------------------------------------------
// classifyTimingError
// ---------------------------------------------------------------------------

/**
 * Options for {@link classifyTimingError}.
 */
export type ClassifyTimingOptions = {
  /**
   * Half-width of the on-time window in seconds. Default `0.05` (50 ms).
   * An absolute error ≤ toleranceSeconds is classified 'on-time'.
   */
  readonly toleranceSeconds?: number;
};

/**
 * Classifies a single timing error (performed − expected) as 'on-time',
 * 'early', or 'late'.
 *
 * - |errorSeconds| ≤ toleranceSeconds ⇒ `'on-time'`
 * - errorSeconds < −toleranceSeconds ⇒ `'early'` (played before the beat)
 * - errorSeconds > toleranceSeconds ⇒ `'late'` (played after the beat)
 *
 * @param errorSeconds Signed error: `performedOnset − expectedOnset`.
 * @param options Tolerance window.
 * @returns The classification.
 * @throws {RangeError} When `toleranceSeconds` is negative or non-finite.
 * @throws {RangeError} When `errorSeconds` is not finite.
 */
export function classifyTimingError(
  errorSeconds: number,
  options?: ClassifyTimingOptions,
): TimingErrorClass {
  requireFinite(errorSeconds, 'errorSeconds');

  const tolerance = options?.toleranceSeconds ?? 0.05;
  requireFiniteNonNegative(tolerance, 'toleranceSeconds');

  const absError = Math.abs(errorSeconds);

  if (absError <= tolerance) return 'on-time';
  if (errorSeconds < 0) return 'early';
  return 'late';
}

// ---------------------------------------------------------------------------
// comparePerformanceTiming — matching helpers
// ---------------------------------------------------------------------------

/**
 * Extract expected onset times from either a plain number array or a Sequence.
 * For Sequence inputs, only note and chord events contribute expected onsets
 * (rests cannot be "played").
 */
function isNumberArray(value: readonly number[] | Sequence): value is readonly number[] {
  return Array.isArray(value);
}

function extractExpectedOnsets(expected: readonly number[] | Sequence): readonly number[] {
  if (isNumberArray(expected)) {
    return expected;
  }

  // Sequence branch — call toAbsoluteSeconds and keep note/chord starts only.
  const timedEvents = expected.toAbsoluteSeconds();

  const onsets: number[] = [];

  for (const event of timedEvents) {
    if (event.type === 'note' || event.type === 'chord') {
      onsets.push(event.startSeconds);
    }
  }

  return onsets;
}

/**
 * Greedy nearest-neighbor matching between expected and performed onset lists.
 * Returns pairs as `[expectedIndex, performedIndex]` sorted by ascending
 * absolute distance. Each index appears at most once.
 */
function nearestNeighborMatch(
  expected: readonly number[],
  performed: readonly number[],
): Array<[number, number]> {
  // Build all candidate pairs with their distances.
  type Candidate = { dist: number; ei: number; pi: number };
  const candidates: Candidate[] = [];

  for (let ei = 0; ei < expected.length; ei++) {
    const exp = expected[ei];

    if (exp === undefined) continue;

    for (let pi = 0; pi < performed.length; pi++) {
      const perf = performed[pi];

      if (perf === undefined) continue;

      candidates.push({ dist: Math.abs(perf - exp), ei, pi });
    }
  }

  // Sort ascending by distance so closest pairs are assigned first.
  candidates.sort((a, b) => a.dist - b.dist);

  const usedExpected = new Set<number>();
  const usedPerformed = new Set<number>();
  const result: Array<[number, number]> = [];

  for (const { ei, pi } of candidates) {
    if (usedExpected.has(ei) || usedPerformed.has(pi)) continue;

    usedExpected.add(ei);
    usedPerformed.add(pi);
    result.push([ei, pi]);
  }

  return result;
}

type MatchAccumulator = {
  events: TimingEvent[];
  onTimeCount: number;
  earlyCount: number;
  lateCount: number;
  matchedExpected: Set<number>;
  matchedPerformed: Set<number>;
};

/**
 * Processes all matched pairs and appends MatchedTimingEvent records to the accumulator.
 */
function processMatchedPairs(
  pairs: Array<[number, number]>,
  expectedOnsets: readonly number[],
  adjustedPerformed: readonly number[],
  performed: readonly PerformedEvent[],
  tolerance: number,
  acc: MatchAccumulator,
): void {
  for (const [ei, pi] of pairs) {
    const exp = expectedOnsets[ei];
    const perf = adjustedPerformed[pi];
    const originalEvent = performed[pi];

    if (exp === undefined || perf === undefined || originalEvent === undefined) continue;

    acc.matchedExpected.add(ei);
    acc.matchedPerformed.add(pi);

    const errorSeconds = perf - exp;
    const classification = classifyTimingError(errorSeconds, { toleranceSeconds: tolerance });

    if (classification === 'on-time') acc.onTimeCount++;
    else if (classification === 'early') acc.earlyCount++;
    else acc.lateCount++;

    acc.events.push({
      type: 'matched',
      expectedOnsetSeconds: exp,
      performedOnsetSeconds: perf,
      errorSeconds,
      classification,
      event: originalEvent,
    });
  }
}

/**
 * Appends MissedTimingEvent records for expected onsets without a match.
 */
function collectMissedEvents(
  expectedOnsets: readonly number[],
  matchedExpected: ReadonlySet<number>,
  events: TimingEvent[],
): void {
  for (let ei = 0; ei < expectedOnsets.length; ei++) {
    if (matchedExpected.has(ei)) continue;

    const exp = expectedOnsets[ei];

    if (exp === undefined) continue;

    const missed: MissedTimingEvent = { type: 'missed', expectedOnsetSeconds: exp };
    events.push(missed);
  }
}

/**
 * Appends ExtraTimingEvent records for performed onsets without a match.
 */
function collectExtraEvents(
  adjustedPerformed: readonly number[],
  performed: readonly PerformedEvent[],
  matchedPerformed: ReadonlySet<number>,
  events: TimingEvent[],
): void {
  for (let pi = 0; pi < adjustedPerformed.length; pi++) {
    if (matchedPerformed.has(pi)) continue;

    const perf = adjustedPerformed[pi];
    const originalEvent = performed[pi];

    if (perf === undefined || originalEvent === undefined) continue;

    const extra: ExtraTimingEvent = {
      type: 'extra',
      performedOnsetSeconds: perf,
      event: originalEvent,
    };

    events.push(extra);
  }
}

/**
 * Compares a live (or recorded) performance against an expected onset grid or
 * {@link Sequence}, returning per-event classification and aggregate counts.
 *
 * Matching strategy: nearest-neighbor greedy assignment (closest expected–
 * performed pairs are matched first). The `toleranceSeconds` parameter only
 * affects the early/late/on-time label — it does NOT restrict the match window.
 * Unmatched expected onsets are reported as `'missed'`; unmatched performed
 * onsets are `'extra'`.
 *
 * A known input latency (`latencyOffsetSeconds`) is subtracted from each
 * performed onset before matching and classification. The adjusted onset is
 * what appears in `performedOnsetSeconds` on each result record.
 *
 * For {@link Sequence} inputs, only note and chord events contribute expected
 * onsets (rests cannot be performed).
 *
 * @param expected Array of expected onset times (seconds) or a {@link Sequence}.
 * @param performed The performed events.
 * @param options Tolerance and latency offset.
 * @returns Full timing comparison with per-event breakdown and aggregate counts.
 * @throws {RangeError} When `toleranceSeconds` is negative or non-finite.
 * @throws {RangeError} When `latencyOffsetSeconds` is non-finite.
 * @throws {RangeError} When any onset is non-finite.
 */
export function comparePerformanceTiming(
  expected: readonly number[] | Sequence,
  performed: readonly PerformedEvent[],
  options?: CompareTimingOptions,
): TimingComparison {
  const tolerance = options?.toleranceSeconds ?? 0.05;
  requireFiniteNonNegative(tolerance, 'toleranceSeconds');

  const latency = options?.latencyOffsetSeconds ?? 0;
  requireFinite(latency, 'latencyOffsetSeconds');

  const expectedOnsets = extractExpectedOnsets(expected);

  for (const onset of expectedOnsets) {
    requireFinite(onset, 'expected onset');
  }

  const adjustedPerformed: number[] = performed.map((event) => {
    requireFinite(event.onsetSeconds, 'performed onset');
    return event.onsetSeconds - latency;
  });

  const pairs = nearestNeighborMatch(expectedOnsets, adjustedPerformed);

  const acc: MatchAccumulator = {
    events: [],
    onTimeCount: 0,
    earlyCount: 0,
    lateCount: 0,
    matchedExpected: new Set<number>(),
    matchedPerformed: new Set<number>(),
  };

  processMatchedPairs(pairs, expectedOnsets, adjustedPerformed, performed, tolerance, acc);
  collectMissedEvents(expectedOnsets, acc.matchedExpected, acc.events);
  collectExtraEvents(adjustedPerformed, performed, acc.matchedPerformed, acc.events);

  return {
    events: Object.freeze(acc.events),
    onTimeCount: acc.onTimeCount,
    earlyCount: acc.earlyCount,
    lateCount: acc.lateCount,
    missedCount: expectedOnsets.length - acc.matchedExpected.size,
    extraCount: adjustedPerformed.length - acc.matchedPerformed.size,
    latencyOffsetSeconds: latency,
    toleranceSeconds: tolerance,
  };
}

// ---------------------------------------------------------------------------
// estimateTempoFromOnsets
// ---------------------------------------------------------------------------

/**
 * Computes the median of a non-empty array of numbers.
 */
function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    const val = sorted[mid];
    return val !== undefined ? val : 0;
  }

  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  return lo !== undefined && hi !== undefined ? (lo + hi) / 2 : 0;
}

/**
 * Derives a BPM estimate from a sequence of onset timestamps using the
 * median inter-onset interval (IOI).
 *
 * `bpm = 60 / (medianIOI / beatsPerInterval)`
 *
 * Returns `null` for fewer than 2 onsets (no IOI can be computed).
 *
 * @param onsets Onset times in seconds, in any order (they are sorted internally).
 * @param options `beatsPerInterval` — how many beats each IOI represents (default `1`).
 * @returns A {@link TempoEstimate} or `null` when fewer than 2 onsets are provided.
 * @throws {RangeError} When any onset is non-finite.
 * @throws {RangeError} When `beatsPerInterval` is not a finite positive number.
 * @throws {RangeError} When any inter-onset interval is zero or negative (unsorted/duplicate onsets).
 */
export function estimateTempoFromOnsets(
  onsets: readonly number[],
  options?: EstimateTempoOptions,
): TempoEstimate | null {
  if (onsets.length < 2) return null;

  for (const onset of onsets) {
    requireFinite(onset, 'onset');
  }

  const beatsPerInterval = options?.beatsPerInterval ?? 1;
  requireFinitePositive(beatsPerInterval, 'beatsPerInterval');

  const sorted = onsets.toSorted((a, b) => a - b);
  const iois: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (prev === undefined || curr === undefined) continue;

    const ioi = curr - prev;

    if (ioi <= 0) {
      throw new RangeError(
        `Inter-onset interval must be positive (check for duplicate or unsorted onsets), received ${ioi}.`,
      );
    }

    iois.push(ioi);
  }

  const medianIoi = median(iois);
  const secondsPerBeat = medianIoi / beatsPerInterval;
  const bpm = 60 / secondsPerBeat;

  return {
    bpm,
    medianInterOnsetSeconds: medianIoi,
    intervalCount: iois.length,
  };
}

// ---------------------------------------------------------------------------
// measureSwingRatio (optional)
// ---------------------------------------------------------------------------

/**
 * Validates subBeatsPerBeat option and throws if invalid.
 */
function validateSubBeats(subBeats: number): void {
  if (!Number.isInteger(subBeats) || subBeats < 1) {
    throw new RangeError(`subBeatsPerBeat must be a positive integer, received ${subBeats}.`);
  }
}

/**
 * Collects swing ratios from sorted onset times in beat groups of `subBeats`.
 * Skips groups where the short interval is non-positive.
 */
function collectSwingRatios(onsets: readonly number[], subBeats: number): number[] {
  const ratios: number[] = [];

  for (let i = 0; i + subBeats < onsets.length; i += subBeats) {
    const first = onsets[i];
    const second = onsets[i + 1];
    const groupEnd = onsets[i + subBeats];

    if (first === undefined || second === undefined || groupEnd === undefined) continue;

    const longInterval = second - first;
    const shortInterval = groupEnd - second;

    if (shortInterval <= 0) continue;

    ratios.push(longInterval / shortInterval);
  }

  return ratios;
}

/**
 * Estimates a swing ratio from a sequence of performed onsets.
 *
 * Swing in jazz is typically expressed as a ratio of a long first 8th note
 * to a short second 8th note within each beat pair. This function pairs
 * consecutive onsets into beat groups of `subBeatsPerBeat` (default `2`),
 * then returns the mean ratio of the first sub-beat duration to the second.
 *
 * A perfectly straight feel returns `1.0`. A 2:1 swing returns `2.0`.
 *
 * Returns `null` when there are fewer than `subBeatsPerBeat + 1` onsets
 * (not enough data for even one complete beat pair), or when all short
 * intervals within groups are zero or negative (degenerate input).
 *
 * @param events Performed events whose onsets define the rhythm.
 * @param options `subBeatsPerBeat` — number of sub-beats per beat pair (default `2`).
 * @returns Mean swing ratio or `null` for insufficient data.
 * @throws {RangeError} When any onset is non-finite.
 * @throws {RangeError} When `subBeatsPerBeat` is not a finite positive integer.
 */
export function measureSwingRatio(
  events: readonly PerformedEvent[],
  options?: MeasureSwingOptions,
): number | null {
  const subBeats = options?.subBeatsPerBeat ?? 2;
  validateSubBeats(subBeats);

  for (const event of events) {
    requireFinite(event.onsetSeconds, 'onsetSeconds');
  }

  const onsets = events
    .toSorted((a, b) => a.onsetSeconds - b.onsetSeconds)
    .map((e) => e.onsetSeconds);

  if (onsets.length < subBeats + 1) return null;

  const ratios = collectSwingRatios(onsets, subBeats);

  if (ratios.length === 0) return null;

  const sum = ratios.reduce((acc, r) => acc + r, 0);
  return sum / ratios.length;
}
