/**
 * Domain types for timed music events and sequences.
 *
 * Imported internally by `sequence.ts` and re-exported from `index.ts`.
 */

import type { Note } from '../note.js';
import type { Chord } from '../chord.js';
import type { Interval } from '../intervals.js';
import type { Rational } from '../rational.js';
import type { Meter } from '../meter.js';

export type { Note, Chord, Interval, Rational, Meter };

// ---------------------------------------------------------------------------
// MusicalTime / MusicalDuration
// ---------------------------------------------------------------------------

/**
 * A position within a sequence, expressed as a whole-note fraction from the
 * sequence start. E.g. `{ numerator: 1, denominator: 4 }` = one quarter note.
 */
export type MusicalTime = Rational;

/**
 * A duration expressed as a whole-note fraction. Identical to {@link Rational}
 * in representation — the alias communicates semantic intent.
 */
export type MusicalDuration = Rational;

// ---------------------------------------------------------------------------
// MusicEvent discriminated union
// ---------------------------------------------------------------------------

/**
 * A sounding note event within a sequence.
 */
export type NoteEvent = {
  /** Discriminant. */
  readonly type: 'note';
  /** The note to play. */
  readonly note: Note;
  /** Start offset from the sequence start, as a whole-note fraction. */
  readonly start: MusicalTime;
  /** Duration as a whole-note fraction. */
  readonly duration: MusicalDuration;
  /**
   * MIDI velocity in 0..127. Absent means "use a default / unspecified".
   * Declared optional with exactOptionalPropertyTypes: property is absent, not `undefined`.
   */
  readonly velocity?: number;
};

/**
 * A sounding chord event within a sequence.
 */
export type ChordEvent = {
  /** Discriminant. */
  readonly type: 'chord';
  /** The chord to play. */
  readonly chord: Chord;
  /** Start offset from the sequence start, as a whole-note fraction. */
  readonly start: MusicalTime;
  /** Duration as a whole-note fraction. */
  readonly duration: MusicalDuration;
  /** MIDI velocity in 0..127. */
  readonly velocity?: number;
};

/**
 * A rest (silence) within a sequence.
 */
export type RestEvent = {
  /** Discriminant. */
  readonly type: 'rest';
  /** Start offset from the sequence start, as a whole-note fraction. */
  readonly start: MusicalTime;
  /** Duration as a whole-note fraction. */
  readonly duration: MusicalDuration;
};

/**
 * A discriminated union of all timed events that can appear in a {@link Sequence}.
 */
export type MusicEvent = NoteEvent | ChordEvent | RestEvent;

// ---------------------------------------------------------------------------
// Absolute-time output
// ---------------------------------------------------------------------------

/**
 * A {@link NoteEvent} enriched with real-time positions.
 */
export type TimedNoteEvent = NoteEvent & {
  readonly startSeconds: number;
  readonly durationSeconds: number;
};

/**
 * A {@link ChordEvent} enriched with real-time positions.
 */
export type TimedChordEvent = ChordEvent & {
  readonly startSeconds: number;
  readonly durationSeconds: number;
};

/**
 * A {@link RestEvent} enriched with real-time positions.
 */
export type TimedRestEvent = RestEvent & {
  readonly startSeconds: number;
  readonly durationSeconds: number;
};

/** A {@link MusicEvent} enriched with absolute real-time positions. */
export type TimedMusicEvent = TimedNoteEvent | TimedChordEvent | TimedRestEvent;

// ---------------------------------------------------------------------------
// Sequence options and serialization
// ---------------------------------------------------------------------------

/**
 * Options for {@link Sequence.create}.
 */
export type SequenceOptions = {
  /** Tempo in BPM. Must be a finite positive number. */
  readonly tempo: number;
  /** Time signature. When absent, assumes a quarter-note beat unit (standard 4/4 feel). */
  readonly meter?: Meter;
};

/** Serialized form of a note event. */
export type SerializedNoteEvent = {
  readonly type: 'note';
  /** Combined note-name-with-octave, e.g. `"C4"` or `"Bb-1"`. */
  readonly noteWithOctave: string;
  readonly start: Rational;
  readonly duration: Rational;
  readonly velocity?: number;
};

/** Serialized form of a chord event. */
export type SerializedChordEvent = {
  readonly type: 'chord';
  /** Root note-name-with-octave, e.g. `"C4"`. */
  readonly rootWithOctave: string;
  /** Canonical chord suffix, e.g. `"maj7"`. */
  readonly suffix: string;
  readonly start: Rational;
  readonly duration: Rational;
  readonly velocity?: number;
};

/** Serialized form of a rest event. */
export type SerializedRestEvent = {
  readonly type: 'rest';
  readonly start: Rational;
  readonly duration: Rational;
};

/** Serialized form of any music event. */
export type SerializedMusicEvent = SerializedNoteEvent | SerializedChordEvent | SerializedRestEvent;

/**
 * A JSON-serializable snapshot of a {@link Sequence}.
 */
export type SerializedSequence = {
  readonly tempo: number;
  readonly meter: { readonly numerator: number; readonly denominator: number } | null;
  readonly events: readonly SerializedMusicEvent[];
};
