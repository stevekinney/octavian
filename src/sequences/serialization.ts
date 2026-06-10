/**
 * Serialization and deserialization helpers for music events.
 *
 * Internal module — not exported from the subpath root.
 */

import { Note, type NoteLike } from '../note.js';
import { Chord } from '../chord.js';
import type { ChordSuffix } from '../chords.js';
import type {
  MusicEvent,
  NoteEvent,
  ChordEvent,
  SerializedMusicEvent,
  SerializedNoteEvent,
  SerializedChordEvent,
} from './types.js';

/**
 * Converts a {@link MusicEvent} to a JSON-safe representation.
 *
 * @param event The event to serialize.
 * @returns The serialized event.
 */
export function serializeEvent(event: MusicEvent): SerializedMusicEvent {
  if (event.type === 'rest') {
    return { type: 'rest', start: event.start, duration: event.duration };
  }

  if (event.type === 'note') {
    return serializeNoteEvent(event);
  }

  return serializeChordEvent(event);
}

function serializeNoteEvent(event: NoteEvent): SerializedNoteEvent {
  const base: SerializedNoteEvent = {
    type: 'note',
    noteWithOctave: `${event.note.note}${event.note.octave}`,
    start: event.start,
    duration: event.duration,
  };

  if (event.velocity !== undefined) {
    return { ...base, velocity: event.velocity };
  }

  return base;
}

function serializeChordEvent(event: ChordEvent): SerializedChordEvent {
  let base: SerializedChordEvent = {
    type: 'chord',
    rootWithOctave: `${event.chord.root.note}${event.chord.root.octave}`,
    suffix: event.chord.suffix,
    start: event.start,
    duration: event.duration,
  };

  // Root position (inversion 0) is the default — omit the field to keep the JSON
  // minimal and mirror the optional-velocity pattern.
  if (event.chord.inversionIndex > 0) {
    base = { ...base, inversion: event.chord.inversionIndex };
  }

  if (event.velocity !== undefined) {
    return { ...base, velocity: event.velocity };
  }

  return base;
}

/**
 * Recreates a {@link MusicEvent} from its serialized form.
 *
 * @param raw The serialized event.
 * @returns The deserialized event.
 */
export function deserializeEvent(raw: SerializedMusicEvent): MusicEvent {
  if (raw.type === 'rest') {
    return { type: 'rest', start: raw.start, duration: raw.duration };
  }

  if (raw.type === 'note') {
    return deserializeNoteEvent(raw);
  }

  if (raw.type === 'chord') {
    return deserializeChordEvent(raw);
  }

  // Trust boundary: a serialized event from external JSON may carry an
  // unknown discriminant. Reject it explicitly rather than mis-deserializing
  // it as a chord.
  throw new TypeError(
    `Unknown serialized event type, received ${JSON.stringify((raw as { type: unknown }).type)}.`,
  );
}

function deserializeNoteEvent(raw: SerializedNoteEvent): NoteEvent {
  // noteWithOctave is a string matching `${NoteName}${Octave}` produced by
  // serializeEvent — the runtime value is always a valid NoteNameWithOctave.
  const note = Note.create(raw.noteWithOctave as NoteLike);
  const base: NoteEvent = { type: 'note', note, start: raw.start, duration: raw.duration };

  if (raw.velocity !== undefined) {
    return { ...base, velocity: raw.velocity };
  }

  return base;
}

function deserializeChordEvent(raw: SerializedChordEvent): ChordEvent {
  // rootWithOctave is produced by serializeEvent — always a valid NoteNameWithOctave.
  const root = Note.create(raw.rootWithOctave as NoteLike);
  // suffix is the canonical ChordSuffix string stored by the Chord class.
  const chord = applyInversion(Chord.create(root, raw.suffix as ChordSuffix), raw.inversion);
  const base: ChordEvent = { type: 'chord', chord, start: raw.start, duration: raw.duration };

  if (raw.velocity !== undefined) {
    return { ...base, velocity: raw.velocity };
  }

  return base;
}

/**
 * Reapplies a serialized inversion index to a freshly-created root-position chord.
 *
 * @param chord The root-position chord.
 * @param inversion The serialized inversion index, or `undefined` for root position.
 * @returns The chord at the requested inversion.
 * @throws {TypeError} When the inversion is not an integer.
 * @throws {RangeError} When the inversion is negative or exceeds the chord's note count.
 */
function applyInversion(chord: Chord, inversion: number | undefined): Chord {
  if (inversion === undefined || inversion === 0) {
    return chord;
  }

  // Shape vs. bounds, per the error taxonomy: a non-integer is a type error,
  // an out-of-range integer is a range error.
  if (!Number.isInteger(inversion)) {
    throw new TypeError(`Serialized chord inversion must be an integer, received ${inversion}.`);
  }

  // Chord.invert wraps modulo the note count; guard both bounds explicitly so an
  // out-of-range serialized index is rejected rather than silently wrapped.
  if (inversion < 0 || inversion >= chord.notes.length) {
    throw new RangeError(
      `Serialized chord inversion ${inversion} is out of range for the ${chord.notes.length}-note chord.`,
    );
  }

  return chord.invert(inversion);
}
