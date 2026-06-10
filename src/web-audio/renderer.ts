/**
 * Web Audio oscillator-backed renderer implementation.
 *
 * All scheduling goes through `scheduleVoice`, which creates an
 * OscillatorNode + GainNode on the caller-provided context. No browser
 * globals are referenced at module scope — everything comes from the caller.
 */

import { Note, noteToFrequency } from '../note.js';
import type { NoteLike } from '../note.js';
import type { Chord } from '../chord.js';
import type { Tuning } from '../tuning.js';
import type { Sequence } from '../sequences/sequence.js';
import type { TimedMusicEvent } from '../sequences/types.js';
import type {
  AudioContextLike,
  AudioNodeLike,
  Envelope,
  RenderOfflineOptions,
  ScheduleChordOptions,
  ScheduleNoteOptions,
  ScheduleSequenceOptions,
  WebAudioRenderer,
  WebAudioRendererOptions,
} from './types.js';

// ---------------------------------------------------------------------------
// Module-level constants — no browser globals
// ---------------------------------------------------------------------------

const DEFAULT_VELOCITY = 64;
const DEFAULT_ATTACK = 0.01;
const DEFAULT_OSCILLATOR_TYPE = 'sine';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the effective velocity for a scheduled event.
 *
 * Returns `defaultVelocity` when `velocity` is absent. Throws when it is
 * present and equal to 0 (Web Audio has no "note-off" concept; velocity-0
 * is meaningless and indicates a caller error).
 *
 * @throws {RangeError} When velocity is present and equals 0.
 */
function resolveVelocity(velocity: number | undefined, defaultVelocity: number): number {
  if (velocity !== undefined && velocity === 0) {
    throw new RangeError(
      `Note event velocity must be 1..127 for Web Audio scheduling (0 is interpreted as note-off), received 0.`,
    );
  }
  return velocity ?? defaultVelocity;
}

/**
 * Converts a MIDI velocity (1..127) to a normalised gain value (0..1).
 *
 * Uses a simple linear mapping: `velocity / 127`.
 */
function velocityToGain(velocity: number): number {
  return velocity / 127;
}

/**
 * Schedules a single oscillator+gain voice on `ctx`.
 *
 * Wires: osc → gain → ctx.destination. Applies a simple ADSR-ish ramp:
 * gain starts at 0, ramps linearly to `gainPeak` over `attack` seconds,
 * then ramps back to 0 at `startTime + duration`.
 *
 * The attack is clamped to the note's end so that a degenerate
 * `attack >= duration` cannot schedule the peak ramp after the release ramp
 * (Web Audio processes automations in time order, which would otherwise
 * produce an unpredictable, never-fading gain).
 */
function scheduleVoice(
  ctx: AudioContextLike,
  frequency: number,
  startTime: number,
  duration: number,
  gainPeak: number,
  envelope: Envelope,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = DEFAULT_OSCILLATOR_TYPE;
  osc.frequency.setValueAtTime(frequency, startTime);

  const endTime = startTime + duration;
  const attackEnd = Math.min(startTime + envelope.attack, endTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, attackEnd);
  gain.gain.linearRampToValueAtTime(0, endTime);

  // Route: osc → gain → destination.
  // GainNodeLike extends AudioNodeLike so the cast is via the shared base type.
  const gainAsNode: AudioNodeLike = gain;
  osc.connect(gainAsNode);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(endTime);
}

/**
 * Returns the frequency for `note`, using `tuning` when provided.
 */
function resolveFrequency(note: NoteLike, tuning: Tuning | undefined): number {
  if (tuning !== undefined) {
    return noteToFrequency(note, tuning);
  }
  return Note.create(note).frequency;
}

/**
 * Schedules all timed music events onto `ctx`, anchored at `anchorSeconds`.
 *
 * Note and chord events are scheduled; rest events are skipped.
 *
 * @throws {RangeError} When a sequence event carries a present velocity of 0.
 */
function scheduleEvents(
  ctx: AudioContextLike,
  events: readonly TimedMusicEvent[],
  anchorSeconds: number,
  defaultVelocity: number,
  defaultEnvelope: Envelope,
  tuning: Tuning | undefined,
): void {
  for (const ev of events) {
    if (ev.type === 'rest') {
      continue;
    }

    const velocity = resolveVelocity(ev.velocity, defaultVelocity);
    const gainPeak = velocityToGain(velocity);
    const startTime = anchorSeconds + ev.startSeconds;
    const duration = ev.durationSeconds;

    if (ev.type === 'note') {
      const frequency = resolveFrequency(ev.note, tuning);
      scheduleVoice(ctx, frequency, startTime, duration, gainPeak, defaultEnvelope);
    } else {
      // ev.type === 'chord'
      for (const note of ev.chord.notes) {
        const frequency = resolveFrequency(note, tuning);
        scheduleVoice(ctx, frequency, startTime, duration, gainPeak, defaultEnvelope);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// createWebAudioRenderer
// ---------------------------------------------------------------------------

/**
 * Creates a Web Audio renderer backed by oscillator+gain voices.
 *
 * All scheduling is performed on the caller-provided `audioContext`. No
 * browser globals are accessed at module import time.
 *
 * @example
 * ```ts
 * const ctx = new AudioContext();
 * const renderer = createWebAudioRenderer({ audioContext: ctx });
 * renderer.scheduleNote('C4', { startTime: ctx.currentTime, duration: 1 });
 * ```
 */
export function createWebAudioRenderer(options: WebAudioRendererOptions): WebAudioRenderer {
  const { audioContext, tuning } = options;
  const defaultEnvelope: Envelope = { attack: DEFAULT_ATTACK };

  const renderer: WebAudioRenderer = {
    scheduleNote(note: NoteLike, noteOptions: ScheduleNoteOptions): void {
      const velocity = resolveVelocity(noteOptions.velocity, DEFAULT_VELOCITY);
      const gainPeak = velocityToGain(velocity);
      const envelope = noteOptions.envelope ?? defaultEnvelope;
      const frequency = resolveFrequency(note, tuning);
      scheduleVoice(
        audioContext,
        frequency,
        noteOptions.startTime,
        noteOptions.duration,
        gainPeak,
        envelope,
      );
    },

    scheduleChord(chord: Chord, chordOptions: ScheduleChordOptions): void {
      const velocity = resolveVelocity(chordOptions.velocity, DEFAULT_VELOCITY);
      const gainPeak = velocityToGain(velocity);
      for (const note of chord.notes) {
        const frequency = resolveFrequency(note, tuning);
        scheduleVoice(
          audioContext,
          frequency,
          chordOptions.startTime,
          chordOptions.duration,
          gainPeak,
          defaultEnvelope,
        );
      }
    },

    scheduleSequence(sequence: Sequence, seqOptions?: ScheduleSequenceOptions): void {
      const startOffset = seqOptions?.startTime ?? 0;
      const anchorSeconds = audioContext.currentTime + startOffset;
      const events = sequence.toAbsoluteSeconds();
      scheduleEvents(
        audioContext,
        events,
        anchorSeconds,
        DEFAULT_VELOCITY,
        defaultEnvelope,
        tuning,
      );
    },

    renderOffline(sequence: Sequence, offlineOptions: RenderOfflineOptions): Promise<unknown> {
      const { offlineContext } = offlineOptions;
      const anchorSeconds = offlineContext.currentTime;
      const events = sequence.toAbsoluteSeconds();
      // OfflineAudioContextLike extends AudioContextLike structurally.
      const offlineAsCtx: AudioContextLike = offlineContext;
      scheduleEvents(
        offlineAsCtx,
        events,
        anchorSeconds,
        DEFAULT_VELOCITY,
        defaultEnvelope,
        tuning,
      );
      return offlineContext.startRendering();
    },
  };

  return renderer;
}
