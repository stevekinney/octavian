/**
 * Pitch-estimate scoring helpers.
 *
 * A pure scoring layer over an application-provided pitch estimate.
 * Does NOT perform pitch detection or access any microphone.
 *
 * Import as `octavian/pitch` (subpath export — not part of the root barrel).
 */

export { evaluatePitchEstimate } from './pitch-estimate.js';

export type {
  PitchEstimate,
  PitchEvaluation,
  EvaluatePitchEstimateOptions,
} from './pitch-estimate.js';
