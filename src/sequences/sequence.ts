/**
 * The {@link Sequence} value object and related validation helpers.
 *
 * Seconds conversion
 * ------------------
 * `toAbsoluteSeconds` converts musical time to real time using:
 *   `seconds = (timeFraction / beatUnit) * (60 / tempo)`
 * where `beatUnit` is the whole-note fraction for one beat.
 * - Without a meter: `beatUnit = 1/4` (quarter note = one beat, standard 4/4 feel).
 * - With a meter: `beatUnit = meter.beatUnit` (e.g. 6/8 → `3/8`, compound meter).
 * Check: quarter note at 120 BPM → `(1/4 ÷ 1/4) × (60/120) = 0.5 s`. Correct.
 */

import type { Interval } from '../intervals.js';
import {
  type Rational,
  createRational,
  addRationals,
  compareRationals,
  rationalsEqual,
  rationalToNumber,
} from '../rational.js';
import { Meter } from '../meter.js';
import { serializeEvent, deserializeEvent } from './serialization.js';
import type {
  MusicEvent,
  NoteEvent,
  ChordEvent,
  MusicalTime,
  MusicalDuration,
  SequenceOptions,
  SerializedSequence,
  TimedMusicEvent,
} from './types.js';

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Convenience constructor for a {@link MusicalTime} or {@link MusicalDuration}
 * from a `[numerator, denominator]` pair.
 *
 * @param numerator The numerator (must be a non-negative integer).
 * @param denominator The denominator (must be a positive integer).
 * @returns The reduced rational fraction.
 */
export function musicalTime(numerator: number, denominator: number): MusicalTime {
  return createRational(numerator, denominator);
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateTempo(tempo: number): void {
  if (!Number.isFinite(tempo) || tempo <= 0) {
    throw new RangeError(`Tempo must be a finite positive number, received ${tempo}.`);
  }
}

function validateVelocity(velocity: number | undefined): void {
  if (velocity === undefined) return;

  if (!Number.isInteger(velocity) || velocity < 0 || velocity > 127) {
    throw new RangeError(`Velocity must be an integer in 0..127, received ${velocity}.`);
  }
}

function validateMusicalTime(value: Rational, label: string): void {
  if (!Number.isInteger(value.numerator) || !Number.isInteger(value.denominator)) {
    throw new TypeError(`${label} must be a rational with integer numerator/denominator.`);
  }

  if (value.denominator <= 0) {
    throw new RangeError(`${label} denominator must be positive, received ${value.denominator}.`);
  }

  if (value.numerator < 0) {
    throw new RangeError(
      `${label} must be non-negative, received ${value.numerator}/${value.denominator}.`,
    );
  }
}

function validateMusicalDuration(value: Rational): void {
  if (!Number.isInteger(value.numerator) || !Number.isInteger(value.denominator)) {
    throw new TypeError('Duration must be a rational with integer numerator/denominator.');
  }

  if (value.denominator <= 0) {
    throw new RangeError(`Duration denominator must be positive, received ${value.denominator}.`);
  }

  if (value.numerator <= 0) {
    throw new RangeError(
      `Duration must be positive, received ${value.numerator}/${value.denominator}.`,
    );
  }
}

function validateEvent(event: MusicEvent): void {
  validateMusicalTime(event.start, 'start');
  validateMusicalDuration(event.duration);

  if (event.type !== 'rest') {
    validateVelocity(event.velocity);
  }
}

// ---------------------------------------------------------------------------
// Transpose helpers
// ---------------------------------------------------------------------------

function transposeNoteEvent(event: NoteEvent, interval: Interval): NoteEvent {
  const base: NoteEvent = {
    type: 'note',
    note: event.note.transpose(interval),
    start: event.start,
    duration: event.duration,
  };

  if (event.velocity !== undefined) {
    return { ...base, velocity: event.velocity };
  }

  return base;
}

function transposeChordEvent(event: ChordEvent, interval: Interval): ChordEvent {
  const base: ChordEvent = {
    type: 'chord',
    chord: event.chord.transpose(interval),
    start: event.start,
    duration: event.duration,
  };

  if (event.velocity !== undefined) {
    return { ...base, velocity: event.velocity };
  }

  return base;
}

// ---------------------------------------------------------------------------
// Equality helpers
// ---------------------------------------------------------------------------

function metersMatch(a: Meter | null, b: Meter | null): boolean {
  if ((a === null) !== (b === null)) return false;

  if (a !== null && b !== null) {
    return a.numerator === b.numerator && a.denominator === b.denominator;
  }

  return true;
}

function noteEventsMatch(a: NoteEvent, b: NoteEvent): boolean {
  return (
    a.note.note === b.note.note && a.note.octave === b.note.octave && a.velocity === b.velocity
  );
}

function chordEventsMatch(a: ChordEvent, b: ChordEvent): boolean {
  return (
    a.chord.root.note === b.chord.root.note &&
    a.chord.root.octave === b.chord.root.octave &&
    a.chord.suffix === b.chord.suffix &&
    a.velocity === b.velocity
  );
}

function eventsMatch(a: MusicEvent, b: MusicEvent): boolean {
  if (a.type !== b.type) return false;
  if (!rationalsEqual(a.start, b.start)) return false;
  if (!rationalsEqual(a.duration, b.duration)) return false;

  if (a.type === 'note' && b.type === 'note') return noteEventsMatch(a, b);
  if (a.type === 'chord' && b.type === 'chord') return chordEventsMatch(a, b);

  return true;
}

// ---------------------------------------------------------------------------
// Module-scoped factory — populated by Sequence static {}
// ---------------------------------------------------------------------------

let createSequence: (events: readonly MusicEvent[], tempo: number, meter: Meter | null) => Sequence;

// ---------------------------------------------------------------------------
// Sequence value object
// ---------------------------------------------------------------------------

/**
 * An immutable, ordered collection of timed music events at a fixed tempo.
 *
 * Events are stored sorted by `start` ascending. Overlapping events are
 * preserved as-is (polyphony).
 */
export class Sequence {
  readonly #events: readonly MusicEvent[];
  readonly #tempo: number;
  readonly #meter: Meter | null;

  /** @internal Use {@link Sequence.create} or {@link Sequence.fromJSON} instead. */
  protected constructor(events: readonly MusicEvent[], tempo: number, meter: Meter | null) {
    this.#events = events;
    this.#tempo = tempo;
    this.#meter = meter;
  }

  static {
    createSequence = (
      events: readonly MusicEvent[],
      tempo: number,
      meter: Meter | null,
    ): Sequence => new Sequence(events, tempo, meter);
  }

  /**
   * Creates a {@link Sequence} from an array of events and tempo options.
   *
   * Events are sorted by `start` ascending on creation; overlapping events are
   * preserved (polyphony). Rests, notes, and chords may be interleaved freely.
   *
   * @param events The events to include.
   * @param options Tempo and optional meter.
   * @returns The created sequence.
   * @throws {RangeError} When `tempo` is not a finite positive number.
   * @throws {RangeError} When an event has a negative start or non-positive duration.
   * @throws {RangeError} When a velocity is outside 0..127.
   */
  public static create(events: readonly MusicEvent[], options: SequenceOptions): Sequence {
    validateTempo(options.tempo);

    for (const event of events) {
      validateEvent(event);
    }

    const sorted = [...events].toSorted((a, b) => compareRationals(a.start, b.start));

    return createSequence(sorted, options.tempo, options.meter ?? null);
  }

  /**
   * Recreates a {@link Sequence} from serialized data produced by {@link Sequence.toJSON}.
   *
   * @param serialized The serialized sequence.
   * @returns The recreated sequence.
   * @throws {TypeError} When the serialized tempo is invalid.
   */
  public static fromJSON(serialized: SerializedSequence): Sequence {
    if (!Number.isFinite(serialized.tempo) || serialized.tempo <= 0) {
      throw new TypeError(`Serialized tempo must be a finite positive number.`);
    }

    const events = serialized.events.map(deserializeEvent);

    for (const event of events) {
      validateEvent(event);
    }

    const sorted = [...events].toSorted((a, b) => compareRationals(a.start, b.start));

    const meter = serialized.meter !== null ? Meter.fromJSON(serialized.meter) : null;

    return createSequence(sorted, serialized.tempo, meter);
  }

  /**
   * The events in this sequence, sorted by start ascending.
   */
  public get events(): readonly MusicEvent[] {
    return this.#events;
  }

  /**
   * The tempo in BPM.
   */
  public get tempo(): number {
    return this.#tempo;
  }

  /**
   * The meter, or `null` when none was specified.
   */
  public get meter(): Meter | null {
    return this.#meter;
  }

  /**
   * Returns a new sequence with all note and chord events transposed by
   * the given interval. Rest events are unchanged.
   *
   * @param interval The interval to transpose by.
   * @returns The transposed sequence.
   */
  public transpose(interval: Interval): Sequence {
    const transposed = this.#events.map((event): MusicEvent => {
      if (event.type === 'note') return transposeNoteEvent(event, interval);
      if (event.type === 'chord') return transposeChordEvent(event, interval);

      return event;
    });

    return createSequence(transposed, this.#tempo, this.#meter);
  }

  /**
   * Returns events with absolute real-time positions computed from the sequence tempo and meter.
   *
   * Conversion formula:
   *   `seconds = (timeFraction / beatUnit) * (60 / tempo)`
   *
   * where `beatUnit` is the whole-note fraction for one beat:
   * - No meter: `beatUnit = 1/4` (quarter note = one beat; standard 4/4 feel).
   * - With meter: `beatUnit = meter.beatUnit` (e.g. 6/8 → `3/8`, compound meter).
   *
   * @returns Events with `startSeconds` and `durationSeconds` added.
   */
  public toAbsoluteSeconds(): readonly TimedMusicEvent[] {
    const beatUnit: Rational =
      this.#meter !== null ? this.#meter.beatUnit : { numerator: 1, denominator: 4 };

    const secondsPerBeat = 60 / this.#tempo;

    const fractionToSeconds = (fraction: Rational): number => {
      const beats = rationalToNumber(fraction) / rationalToNumber(beatUnit);
      return beats * secondsPerBeat;
    };

    return this.#events.map((event) => ({
      ...event,
      startSeconds: fractionToSeconds(event.start),
      durationSeconds: fractionToSeconds(event.duration),
    })) as readonly TimedMusicEvent[];
  }

  /**
   * Returns all events whose `start` falls within `[startTime, endTime)`.
   *
   * The window is half-open: inclusive of `startTime`, exclusive of `endTime`.
   *
   * @param startTime The inclusive lower bound.
   * @param endTime The exclusive upper bound.
   * @returns Events within the range, preserving sort order.
   */
  public eventsInRange(startTime: MusicalTime, endTime: MusicalTime): readonly MusicEvent[] {
    return this.#events.filter(
      (event) =>
        compareRationals(event.start, startTime) >= 0 && compareRationals(event.start, endTime) < 0,
    );
  }

  /**
   * Returns the total length of the sequence as a whole-note fraction,
   * defined as `start + duration` of the latest-ending event.
   * Returns `{ numerator: 0, denominator: 1 }` for an empty sequence.
   *
   * @returns The total duration.
   */
  public totalDuration(): MusicalDuration {
    if (this.#events.length === 0) {
      return { numerator: 0, denominator: 1 };
    }

    let max: Rational = { numerator: 0, denominator: 1 };

    for (const event of this.#events) {
      const end = addRationals(event.start, event.duration);

      if (compareRationals(end, max) > 0) {
        max = end;
      }
    }

    return max;
  }

  /**
   * Returns `true` when the sequence has no events.
   *
   * @returns `true` for an empty sequence.
   */
  public isEmpty(): boolean {
    return this.#events.length === 0;
  }

  /**
   * Returns `true` when another sequence has the same tempo, meter, and events.
   *
   * @param other The sequence to compare.
   * @returns `true` when the sequences are equal.
   */
  public equals(other: Sequence): boolean {
    if (this.#tempo !== other.tempo) return false;
    if (!metersMatch(this.#meter, other.meter)) return false;
    if (this.#events.length !== other.events.length) return false;

    return this.#events.every((event, i) => {
      const otherEvent = other.events[i];
      return otherEvent !== undefined && eventsMatch(event, otherEvent);
    });
  }

  /**
   * Serializes the sequence to a JSON-safe value for deterministic storage and share links.
   *
   * Recreate with {@link Sequence.fromJSON}.
   *
   * @returns The serialized sequence.
   */
  public toJSON(): SerializedSequence {
    const meter =
      this.#meter !== null
        ? { numerator: this.#meter.numerator, denominator: this.#meter.denominator }
        : null;

    return {
      tempo: this.#tempo,
      meter,
      events: this.#events.map(serializeEvent),
    };
  }

  /**
   * Returns the custom `Object.prototype.toString` tag.
   */
  public get [Symbol.toStringTag](): string {
    return `Sequence(${this.#events.length} event(s), ${this.#tempo} BPM)`;
  }
}
