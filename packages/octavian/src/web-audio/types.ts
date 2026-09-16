/**
 * Structural *Like interfaces for Web Audio API objects.
 *
 * These are minimal structural interfaces declaring only the members actually
 * called by the web-audio renderer. They exist because tsconfig `lib` is
 * `["ESNext"]` — there is no DOM lib in this repo, so `AudioContext`,
 * `OscillatorNode`, `GainNode` etc. are not known global type names.
 *
 * Signatures match the MDN Web Audio API specification.
 */

import type { Tuning } from '../tuning.js';
import type { NoteLike } from '../note.js';
import type { Chord } from '../chord.js';
import type { Sequence } from '../sequences/sequence.js';

// ---------------------------------------------------------------------------
// AudioNodeLike
// ---------------------------------------------------------------------------

/**
 * Minimal structural interface for an AudioNode — supports `connect` only.
 */
export type AudioNodeLike = {
  /** Connects this node's output to the input of another node. */
  connect(node: AudioNodeLike): unknown;
};

// ---------------------------------------------------------------------------
// AudioParamLike
// ---------------------------------------------------------------------------

/**
 * Minimal structural interface for an AudioParam.
 *
 * Supports scheduling value changes via `setValueAtTime` and
 * `linearRampToValueAtTime`, plus direct `value` reads.
 */
export type AudioParamLike = {
  /** Current value of the audio parameter. */
  value: number;
  /**
   * Schedules a parameter value change at a precise time.
   *
   * @param value - The value to set.
   * @param startTime - The time (in seconds) at which to set the value.
   */
  setValueAtTime(value: number, startTime: number): unknown;
  /**
   * Schedules a linear ramp to reach a target value by a given time.
   *
   * @param value - The target value.
   * @param endTime - The time (in seconds) to reach the target value.
   */
  linearRampToValueAtTime(value: number, endTime: number): unknown;
};

// ---------------------------------------------------------------------------
// OscillatorNodeLike
// ---------------------------------------------------------------------------

/**
 * Minimal structural interface for an OscillatorNode.
 *
 * Covers frequency control, type selection, routing, and start/stop
 * scheduling.
 */
export type OscillatorNodeLike = AudioNodeLike & {
  /** Controls the frequency of the oscillator in Hz. */
  frequency: AudioParamLike;
  /** Waveform type (e.g. `'sine'`, `'square'`, `'sawtooth'`, `'triangle'`). */
  type: string;
  /**
   * Schedules the oscillator to start at the given time.
   *
   * @param when - Context time (in seconds) to begin.
   */
  start(when: number): void;
  /**
   * Schedules the oscillator to stop at the given time.
   *
   * @param when - Context time (in seconds) to stop.
   */
  stop(when: number): void;
};

// ---------------------------------------------------------------------------
// GainNodeLike
// ---------------------------------------------------------------------------

/**
 * Minimal structural interface for a GainNode.
 *
 * Covers gain control and routing.
 */
export type GainNodeLike = AudioNodeLike & {
  /** Controls the gain (amplitude) of the signal. */
  gain: AudioParamLike;
};

// ---------------------------------------------------------------------------
// AudioContextLike
// ---------------------------------------------------------------------------

/**
 * Minimal structural interface for an AudioContext (online or offline).
 *
 * Covers only the factory methods and destination used by the renderer.
 */
export type AudioContextLike = {
  /** Current playback position of the context, in seconds. */
  readonly currentTime: number;
  /** Creates a new OscillatorNode. */
  createOscillator(): OscillatorNodeLike;
  /** Creates a new GainNode. */
  createGain(): GainNodeLike;
  /** The final destination node of the audio graph. */
  readonly destination: AudioNodeLike;
};

// ---------------------------------------------------------------------------
// OfflineAudioContextLike
// ---------------------------------------------------------------------------

/**
 * Minimal structural interface for an OfflineAudioContext.
 *
 * Extends {@link AudioContextLike} with `startRendering`, which begins offline
 * rendering and resolves with the platform's rendered audio buffer.
 */
export type OfflineAudioContextLike = AudioContextLike & {
  /**
   * Begins rendering and returns a Promise that resolves with the platform's
   * rendered audio buffer.
   *
   * Typed as `unknown` on purpose: this package has no DOM lib, so it cannot
   * reference the real `AudioBuffer` type, and the renderer only passes the
   * result through — it never reads it. A caller (which, by virtue of owning an
   * `OfflineAudioContext`, is already in a DOM-typed context) can cast the
   * resolved value to `AudioBuffer` for full fidelity.
   */
  startRendering(): Promise<unknown>;
};

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/**
 * A simple ADSR-ish gain envelope for a scheduled voice.
 *
 * All times are relative offsets from the voice's `startTime`, in seconds.
 * The envelope ramps gain from 0 → peak over `attack`, holds at peak, then
 * ramps back to 0 at `startTime + duration`.
 */
export type Envelope = {
  /**
   * Time (in seconds) to ramp from silence to full gain after the voice
   * starts. Must be ≥ 0. Defaults to `0.01`.
   */
  readonly attack: number;
};

// ---------------------------------------------------------------------------
// ScheduleNoteOptions
// ---------------------------------------------------------------------------

/**
 * Options for {@link WebAudioRenderer.scheduleNote}.
 */
export type ScheduleNoteOptions = {
  /** Absolute audio-context time (seconds) at which to start the note. */
  readonly startTime: number;
  /** Duration of the note in seconds. */
  readonly duration: number;
  /** Optional gain envelope overriding the renderer default. */
  readonly envelope?: Envelope;
  /**
   * MIDI velocity (1..127). Absent → use the renderer default velocity.
   * A present value of 0 throws RangeError (0 = note-off).
   */
  readonly velocity?: number;
};

// ---------------------------------------------------------------------------
// ScheduleChordOptions
// ---------------------------------------------------------------------------

/**
 * Options for {@link WebAudioRenderer.scheduleChord}.
 */
export type ScheduleChordOptions = {
  /** Absolute audio-context time (seconds) at which to start the chord. */
  readonly startTime: number;
  /** Duration of the chord in seconds. */
  readonly duration: number;
  /**
   * MIDI velocity (1..127). Absent → use the renderer default velocity.
   * A present value of 0 throws RangeError (0 = note-off).
   */
  readonly velocity?: number;
};

// ---------------------------------------------------------------------------
// ScheduleSequenceOptions
// ---------------------------------------------------------------------------

/**
 * Options for {@link WebAudioRenderer.scheduleSequence}.
 */
export type ScheduleSequenceOptions = {
  /**
   * Additional offset (in seconds) added to `audioContext.currentTime` before
   * placing the first event. Defaults to `0`.
   */
  readonly startTime?: number;
};

// ---------------------------------------------------------------------------
// RenderOfflineOptions
// ---------------------------------------------------------------------------

/**
 * Options for {@link WebAudioRenderer.renderOffline}.
 */
export type RenderOfflineOptions = {
  /**
   * Caller-constructed offline audio context. The renderer wires the
   * oscillator/gain graph onto this context and calls `startRendering()`.
   */
  readonly offlineContext: OfflineAudioContextLike;
};

// ---------------------------------------------------------------------------
// WebAudioRendererOptions
// ---------------------------------------------------------------------------

/**
 * Options for {@link createWebAudioRenderer}.
 */
export type WebAudioRendererOptions = {
  /** The live AudioContext to schedule voices on. */
  readonly audioContext: AudioContextLike;
  /**
   * Optional tuning reference. When provided, `noteToFrequency(note, tuning)`
   * is used instead of `note.frequency`. Defaults to A4 = 440 Hz.
   */
  readonly tuning?: Tuning;
};

// ---------------------------------------------------------------------------
// WebAudioRenderer
// ---------------------------------------------------------------------------

/**
 * The renderer object returned by {@link createWebAudioRenderer}.
 */
export type WebAudioRenderer = {
  /**
   * Schedules a single oscillator+gain voice for one note.
   *
   * @throws {RangeError} When a present velocity is 0.
   */
  scheduleNote(note: NoteLike, options: ScheduleNoteOptions): void;

  /**
   * Schedules one oscillator+gain voice per note in the chord.
   *
   * @throws {RangeError} When a present velocity is 0.
   */
  scheduleChord(chord: Chord, options: ScheduleChordOptions): void;

  /**
   * Iterates `sequence.toAbsoluteSeconds()` and schedules every note/chord
   * event anchored at `audioContext.currentTime + (startTime ?? 0)`.
   * Rest events are skipped.
   *
   * @throws {RangeError} When a sequence event has a present velocity of 0.
   */
  scheduleSequence(sequence: Sequence, options?: ScheduleSequenceOptions): void;

  /**
   * Schedules all sequence events onto `offlineContext` (anchored at
   * `offlineContext.currentTime`) and returns `offlineContext.startRendering()`.
   *
   * Resolves with the platform's rendered audio buffer, typed `unknown` (this
   * package has no DOM lib). Cast the resolved value to `AudioBuffer` in a DOM
   * context. See {@link OfflineAudioContextLike.startRendering}.
   */
  renderOffline(sequence: Sequence, options: RenderOfflineOptions): Promise<unknown>;
};
