/**
 * Web Audio adapter for octavian.
 *
 * Import as `octavian/web-audio` (this is a subpath export, not part of the
 * root barrel at `octavian`). The root `src/index.ts` MUST NOT re-export
 * from this module.
 *
 * Provides {@link createWebAudioRenderer} — an oscillator-backed scheduler
 * that accepts a caller-provided AudioContext and produces timed voices for
 * notes, chords, and sequences.
 *
 * No browser globals are referenced at module scope. All runtime browser
 * objects come from the caller.
 *
 * Import path: `octavian/web-audio`
 */

// Values
export { createWebAudioRenderer } from './renderer.js';

// Types
export type {
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  GainNodeLike,
  OscillatorNodeLike,
  OfflineAudioContextLike,
  Envelope,
  ScheduleNoteOptions,
  ScheduleChordOptions,
  ScheduleSequenceOptions,
  RenderOfflineOptions,
  WebAudioRendererOptions,
  WebAudioRenderer,
} from './types.js';
