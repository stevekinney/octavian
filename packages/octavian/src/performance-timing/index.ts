/**
 * Performance timing analysis helpers for octavian.
 *
 * Import as `octavian/perf-timing` (this is a subpath export, not part of
 * the root barrel at `octavian`). The root `src/index.ts` MUST NOT re-export
 * from this module.
 *
 * Provides pure math over performed events vs. an expected grid/sequence:
 * - {@link quantizePerformance} — snap onsets to a grid, preserving humanized deviations
 * - {@link comparePerformanceTiming} — match performed onsets to expected, classify timing
 * - {@link classifyTimingError} — classify a single signed error as early/late/on-time
 * - {@link estimateTempoFromOnsets} — derive BPM from median inter-onset interval
 * - {@link measureSwingRatio} — estimate swing ratio from onset pairs
 *
 * Import path: `octavian/perf-timing`
 */

// Values (functions) first, then types.
export {
  quantizePerformance,
  classifyTimingError,
  comparePerformanceTiming,
  estimateTempoFromOnsets,
  measureSwingRatio,
} from './performance-timing.js';

export type { QuantizeOptions, ClassifyTimingOptions } from './performance-timing.js';

export type {
  PerformedEvent,
  TimingErrorClass,
  QuantizedEvent,
  QuantizedPerformance,
  MatchedTimingEvent,
  MissedTimingEvent,
  ExtraTimingEvent,
  TimingEvent,
  CompareTimingOptions,
  TimingComparison,
  TempoEstimate,
  EstimateTempoOptions,
  MeasureSwingOptions,
} from './types.js';
