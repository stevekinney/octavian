/**
 * Domain types for performance-timing analysis.
 *
 * All types are pure data (no class instances). Domain-specific types live
 * next to the module — there is no shared root types file.
 */

import type { Note } from '../note.js';

// ---------------------------------------------------------------------------
// PerformedEvent
// ---------------------------------------------------------------------------

/**
 * A single event captured from a live (or recorded) musical performance.
 * Only `onsetSeconds` is required; the remaining fields are optional context.
 */
export type PerformedEvent = {
  /** The wall-clock time (in seconds) at which the event was triggered. */
  readonly onsetSeconds: number;
  /** How long the event was held, in seconds. Optional. */
  readonly durationSeconds?: number;
  /** The note that was played, if known. */
  readonly note?: Note;
  /** MIDI velocity (0..127), if available. */
  readonly velocity?: number;
};

// ---------------------------------------------------------------------------
// TimingError classification
// ---------------------------------------------------------------------------

/**
 * Classification of a single event's timing relative to an expected onset.
 * - `'on-time'`: |error| ≤ toleranceSeconds
 * - `'early'`: error < −toleranceSeconds (played before the expected onset)
 * - `'late'`: error > toleranceSeconds (played after the expected onset)
 */
export type TimingErrorClass = 'early' | 'late' | 'on-time';

// ---------------------------------------------------------------------------
// QuantizedPerformance
// ---------------------------------------------------------------------------

/**
 * A single event after grid-quantization.
 */
export type QuantizedEvent = {
  /** The original onset time from the source {@link PerformedEvent}. */
  readonly originalOnsetSeconds: number;
  /** The nearest grid position (multiple of gridSeconds). */
  readonly quantizedOnsetSeconds: number;
  /**
   * Signed deviation: `originalOnsetSeconds − quantizedOnsetSeconds`.
   * Positive means the player was late relative to the grid; negative means early.
   */
  readonly deviationSeconds: number;
  /** Pass-through of the source event's optional fields. */
  readonly durationSeconds?: number;
  /** Pass-through of the source event's optional note. */
  readonly note?: Note;
  /** Pass-through of the source event's optional velocity. */
  readonly velocity?: number;
};

/**
 * The result of {@link quantizePerformance}: each performed onset snapped to
 * the nearest grid position, with the signed humanized-timing deviation preserved.
 */
export type QuantizedPerformance = {
  /** The grid interval used for quantization, in seconds. */
  readonly gridSeconds: number;
  /** A swing/latency offset that was applied before quantization (0 if none). */
  readonly offsetSeconds: number;
  /** The quantized events in the same order as the input. */
  readonly events: readonly QuantizedEvent[];
};

// ---------------------------------------------------------------------------
// TimingComparison
// ---------------------------------------------------------------------------

/**
 * A performed onset successfully matched to an expected onset.
 */
export type MatchedTimingEvent = {
  /** Discriminant. */
  readonly type: 'matched';
  /** Expected onset time in seconds (after any latency correction on the performed side). */
  readonly expectedOnsetSeconds: number;
  /** Performed onset time in seconds (after latency offset subtraction). */
  readonly performedOnsetSeconds: number;
  /**
   * Signed timing error: `performedOnsetSeconds − expectedOnsetSeconds`.
   * Positive ⇒ late; negative ⇒ early.
   */
  readonly errorSeconds: number;
  /** Classification of the timing error using the provided tolerance. */
  readonly classification: TimingErrorClass;
  /** The original {@link PerformedEvent} that produced this match. */
  readonly event: PerformedEvent;
};

/**
 * An expected onset that had no matching performed onset.
 */
export type MissedTimingEvent = {
  /** Discriminant. */
  readonly type: 'missed';
  /** The expected onset time that was not performed. */
  readonly expectedOnsetSeconds: number;
};

/**
 * A performed onset that had no matching expected onset.
 */
export type ExtraTimingEvent = {
  /** Discriminant. */
  readonly type: 'extra';
  /** The performed onset time (after latency offset subtraction). */
  readonly performedOnsetSeconds: number;
  /** The original {@link PerformedEvent}. */
  readonly event: PerformedEvent;
};

/**
 * A union of all per-event comparison results.
 */
export type TimingEvent = MatchedTimingEvent | MissedTimingEvent | ExtraTimingEvent;

/**
 * Options for {@link comparePerformanceTiming}.
 */
export type CompareTimingOptions = {
  /**
   * Half-width of the on-time window, in seconds. Default `0.05` (50 ms).
   * An |error| ≤ toleranceSeconds is classified 'on-time'.
   */
  readonly toleranceSeconds?: number;
  /**
   * Known input latency, in seconds. Subtracted from each performed onset
   * before matching. Default `0`.
   */
  readonly latencyOffsetSeconds?: number;
};

/**
 * Full result of {@link comparePerformanceTiming}.
 */
export type TimingComparison = {
  /** Per-event breakdown (matched, missed, and extra events). */
  readonly events: readonly TimingEvent[];
  /** Number of events classified 'on-time'. */
  readonly onTimeCount: number;
  /** Number of events classified 'early'. */
  readonly earlyCount: number;
  /** Number of events classified 'late'. */
  readonly lateCount: number;
  /** Number of expected onsets with no matching performed event. */
  readonly missedCount: number;
  /** Number of performed onsets with no matching expected event. */
  readonly extraCount: number;
  /** Latency offset actually applied (0 if not provided). */
  readonly latencyOffsetSeconds: number;
  /** Tolerance actually used. */
  readonly toleranceSeconds: number;
};

// ---------------------------------------------------------------------------
// TempoEstimate
// ---------------------------------------------------------------------------

/**
 * Options for {@link estimateTempoFromOnsets}.
 */
export type EstimateTempoOptions = {
  /**
   * Number of beats each inter-onset interval represents. Default `1`
   * (each onset is one beat). Use `2` if each onset is a half note, etc.
   */
  readonly beatsPerInterval?: number;
};

/**
 * Result of {@link estimateTempoFromOnsets}.
 */
export type TempoEstimate = {
  /** Estimated tempo in BPM. */
  readonly bpm: number;
  /** The median inter-onset interval used for the BPM derivation, in seconds. */
  readonly medianInterOnsetSeconds: number;
  /** Number of inter-onset intervals analyzed. */
  readonly intervalCount: number;
};

// ---------------------------------------------------------------------------
// MeasureSwingOptions
// ---------------------------------------------------------------------------

/**
 * Options for {@link measureSwingRatio}.
 */
export type MeasureSwingOptions = {
  /**
   * Expected number of sub-beats per beat pair for swing analysis. Default `2`
   * (standard 8th-note swing: two 8th notes per beat).
   */
  readonly subBeatsPerBeat?: number;
};
