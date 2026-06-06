import {
  addRationals,
  compareRationals,
  createRational,
  rationalsEqual,
  subtractRationals,
  type Rational,
} from './rational.js';
import { Duration, totalDurationFraction } from './duration.js';
import type { Meter } from './meter.js';

// ---------------------------------------------------------------------------
// RhythmEvent — a duration with an optional note onset position
// ---------------------------------------------------------------------------

/**
 * A single event in a rhythm pattern: a duration that may be a rest or a sounding note.
 * Ties are expressed via the {@link Duration.isTied} flag on individual durations.
 */
export type RhythmEvent = Duration;

// ---------------------------------------------------------------------------
// Swing types
// ---------------------------------------------------------------------------

/**
 * A swing timing offset for a single event.
 *
 * Swing is METADATA only — it describes a timing shift for performance
 * but does NOT change the written {@link Duration.fraction}.
 */
export type SwingOffset = {
  /** The event index within the pattern (zero-based). */
  readonly eventIndex: number;
  /**
   * The timing offset relative to the notated position, expressed as a fraction of a beat.
   * Positive values shift the attack later; negative values shift it earlier.
   */
  readonly offset: Rational;
};

/**
 * Swing descriptor returned by swing helpers.
 * The written durations in the pattern are unchanged; this structure encodes timing offsets.
 */
export type SwingDescriptor = {
  /** The pair-ratio applied to subdivisions (e.g. 2/3 for standard triplet swing). */
  readonly ratio: Rational;
  /** Per-event timing offsets relative to straight (unswung) positions. */
  readonly offsets: readonly SwingOffset[];
};

// ---------------------------------------------------------------------------
// Rhythm comparison types
// ---------------------------------------------------------------------------

/**
 * The result of comparing two rhythm patterns.
 */
export type RhythmComparison = {
  /** `true` when the patterns have the same sequence of written fractions. */
  readonly isIdentical: boolean;
  /**
   * `true` when the patterns have the same total duration but differ in subdivision.
   */
  readonly hasSameDuration: boolean;
  /** The total duration of pattern `a`. */
  readonly durationA: Rational;
  /** The total duration of pattern `b`. */
  readonly durationB: Rational;
};

// ---------------------------------------------------------------------------
// Grid position
// ---------------------------------------------------------------------------

/**
 * A position on the subdivision grid for a rhythm event.
 */
export type GridPosition = {
  /** The event index in the pattern (zero-based). */
  readonly eventIndex: number;
  /** The onset position as a whole-note fraction from the start of the pattern. */
  readonly onset: Rational;
  /** The duration of this event. */
  readonly duration: Duration;
  /**
   * The beat number (one-based) this onset falls on, measured in beat units of the meter.
   * Fractional when the onset is between beats.
   */
  readonly beatPosition: Rational;
};

// ---------------------------------------------------------------------------
// Module-scoped factory — populated by RhythmPattern.static {}
// ---------------------------------------------------------------------------

let createRhythmPattern: (events: readonly RhythmEvent[]) => RhythmPattern;

// ---------------------------------------------------------------------------
// RhythmPattern value object
// ---------------------------------------------------------------------------

/**
 * An immutable sequence of rhythm events (durations and rests).
 *
 * All timing is expressed in whole-note fractions. Duration arithmetic uses
 * exact rational arithmetic — no floating-point drift.
 */
export class RhythmPattern {
  readonly #events: readonly RhythmEvent[];
  readonly #total: Rational;

  /** @internal Use {@link RhythmPattern.create} instead. */
  protected constructor(events: readonly RhythmEvent[]) {
    this.#events = Object.freeze([...events]);
    this.#total = totalDurationFraction(this.#events);
  }

  static {
    createRhythmPattern = (events: readonly RhythmEvent[]): RhythmPattern =>
      new RhythmPattern(events);
  }

  /**
   * Creates a rhythm pattern from an ordered array of duration events.
   *
   * @param events The ordered array of durations or rests.
   * @returns The created rhythm pattern.
   * @throws {TypeError} When the events array is empty.
   */
  public static create(events: readonly RhythmEvent[]): RhythmPattern {
    if (events.length === 0) {
      throw new TypeError(`A rhythm pattern must contain at least one event.`);
    }

    return createRhythmPattern(events);
  }

  /**
   * The ordered events in the pattern.
   */
  public get events(): readonly RhythmEvent[] {
    return this.#events;
  }

  /**
   * Returns the total duration of all events as a whole-note fraction.
   *
   * @returns The total duration.
   */
  public totalDuration(): Rational {
    return this.#total;
  }

  /**
   * Returns `true` when the pattern's total duration fills a positive integer number of measures.
   *
   * @param meter The meter to test against.
   * @returns `true` when the pattern fits an exact number of measures.
   */
  public fitsMeter(meter: Meter): boolean {
    return meter.fitsExactly(this.#total);
  }

  /**
   * Computes the onset position and beat position for every event.
   *
   * @param meter The meter to use for beat-position computation.
   * @param subdivision The grid subdivision as a whole-note fraction. Defaults to the meter's beat unit.
   * @returns An ordered array of grid positions.
   */
  public subdivisionGrid(meter: Meter, subdivision?: Rational): readonly GridPosition[] {
    const beatUnit = subdivision ?? meter.beatUnit;
    const positions: GridPosition[] = [];
    let cursor: Rational = { numerator: 0, denominator: 1 };

    for (let i = 0; i < this.#events.length; i += 1) {
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      const event = this.#events[i]!;
      // beatPosition = onset / beatUnit = onset * (beatUnit.denominator / beatUnit.numerator)
      const beatPosition: Rational = createRational(
        cursor.numerator * beatUnit.denominator,
        cursor.denominator * beatUnit.numerator,
      );

      positions.push({ eventIndex: i, onset: cursor, duration: event, beatPosition });
      cursor = addRationals(cursor, event.fraction());
    }

    return Object.freeze(positions);
  }

  /**
   * Returns `true` when the pattern contains syncopation against the given meter.
   *
   * A note is syncopated when it begins on an off-beat position (not a multiple of the
   * beat unit) AND either sustains across the next beat boundary or the next event is a rest.
   *
   * @param meter The meter to check against.
   * @param options Reserved for future options.
   * @returns `true` when at least one event is syncopated.
   */
  public isSyncopated(meter: Meter, options?: Record<string, never>): boolean {
    void options;
    const grid = this.subdivisionGrid(meter);
    const beatUnit = meter.beatUnit;

    for (let i = 0; i < grid.length; i += 1) {
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      const pos = grid[i]!;

      if (pos.duration.isRest) continue;

      // Check if onset is on a beat boundary.
      const onBeat = isOnBeat(pos.onset, beatUnit);

      if (!onBeat) {
        // Off-beat attack — check if it sustains across the next beat boundary.
        const nextBeat = nextBeatBoundary(pos.onset, beatUnit);
        const eventEnd = addRationals(pos.onset, pos.duration.fraction());

        if (compareRationals(eventEnd, nextBeat) > 0) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Returns a swing descriptor that encodes timing offsets for even-subdivision pairs in this pattern.
   * The written durations are NOT changed — swing is purely a performance metadata layer.
   *
   * Standard swing (ratio ≈ 2:1) can be expressed as `ratio = createRational(2, 3)`:
   * the first eighth of each pair lasts 2/3 of a beat, the second lasts 1/3.
   *
   * @param ratio The ratio of the long note to the full beat (e.g. `{numerator:2, denominator:3}` for standard triplet swing).
   * @returns A {@link SwingDescriptor} with the per-event timing offsets.
   */
  public withSwing(ratio: Rational): SwingDescriptor {
    const offsets: SwingOffset[] = [];
    const beatUnit = { numerator: 1, denominator: 4 }; // default to quarter-note beat

    // For each event, compute how much its actual attack is offset from the notated position.
    // Standard swing pairs the 1st and 2nd eighth notes of each beat.
    // pair index 0 (down-beat eighth): offset = 0
    // pair index 1 (up-beat eighth): offset = (ratio - 1/2) × beatUnit
    // This gives a tangible shift without altering the written fraction.
    let cursor: Rational = { numerator: 0, denominator: 1 };

    for (let i = 0; i < this.#events.length; i += 1) {
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      const event = this.#events[i]!;

      // Determine where within the beat this event falls.
      const beatPos = createRational(
        cursor.numerator * beatUnit.denominator,
        cursor.denominator * beatUnit.numerator,
      );
      // Sub-beat position: fractional part of beatPos
      const subBeat = subtractFractional(beatPos);

      // An eighth note is half a quarter-note beat.
      // If this event is roughly on the second eighth of a beat, apply swing offset.
      const halfBeat = createRational(1, 2);
      const isSecondEighth = rationalsEqual(subBeat, halfBeat);

      let offset: Rational = { numerator: 0, denominator: 1 };

      if (isSecondEighth) {
        // notated upbeat = 1/2 beat; swung upbeat onset = ratio; offset = ratio - 1/2
        // Positive offset means the attack is delayed (later), matching standard swing feel.
        offset = subtractRationals(ratio, createRational(1, 2));
      }

      offsets.push({ eventIndex: i, offset });
      cursor = addRationals(cursor, event.fraction());
    }

    return { ratio, offsets: Object.freeze(offsets) };
  }

  /**
   * Returns the number of events in the pattern.
   */
  public get length(): number {
    return this.#events.length;
  }

  /**
   * Returns an iterator over the pattern events.
   *
   * @returns An iterator over the events.
   */
  public [Symbol.iterator](): IterableIterator<RhythmEvent> {
    return this.#events[Symbol.iterator]();
  }

  /**
   * Returns the custom `Object.prototype.toString` tag.
   */
  public get [Symbol.toStringTag](): string {
    return `RhythmPattern(${this.#events.length} events)`;
  }
}

// ---------------------------------------------------------------------------
// Comparison utility
// ---------------------------------------------------------------------------

/**
 * Compares two rhythm patterns and returns a structured comparison result.
 *
 * @param a The first pattern.
 * @param b The second pattern.
 * @param options Reserved for future options.
 * @returns A {@link RhythmComparison} describing the relationship.
 */
export function compareRhythm(
  a: RhythmPattern,
  b: RhythmPattern,
  options?: Record<string, never>,
): RhythmComparison {
  void options;
  const durationA = a.totalDuration();
  const durationB = b.totalDuration();
  const hasSameDuration = rationalsEqual(durationA, durationB);

  const isIdentical =
    hasSameDuration &&
    a.events.length === b.events.length &&
    a.events.every((event, index) => {
      const other = b.events[index];
      return other !== undefined && event.equals(other);
    });

  return { isIdentical, hasSameDuration, durationA, durationB };
}

// ---------------------------------------------------------------------------
// Private utilities
// ---------------------------------------------------------------------------

/**
 * Returns `true` when a position is exactly on a beat boundary.
 *
 * @param position The onset position as a whole-note fraction.
 * @param beatUnit The beat unit as a whole-note fraction.
 * @returns `true` when position / beatUnit is an integer.
 */
function isOnBeat(position: Rational, beatUnit: Rational): boolean {
  // position / beatUnit = (position.numerator * beatUnit.denominator) / (position.denominator * beatUnit.numerator)
  const numProd = position.numerator * beatUnit.denominator;
  const denProd = position.denominator * beatUnit.numerator;

  if (denProd === 0) return false;

  return numProd % denProd === 0;
}

/**
 * Returns the next beat boundary after `position`.
 *
 * @param position The current onset position.
 * @param beatUnit The beat unit.
 * @returns The next beat boundary as a whole-note fraction.
 */
function nextBeatBoundary(position: Rational, beatUnit: Rational): Rational {
  // floor(position / beatUnit) + 1 beat units
  const numProd = position.numerator * beatUnit.denominator;
  const denProd = position.denominator * beatUnit.numerator;
  const wholeBeat = Math.floor(numProd / denProd) + 1;

  return createRational(wholeBeat * beatUnit.numerator, beatUnit.denominator);
}

/**
 * Returns the fractional part of a rational (r - floor(r)).
 *
 * @param r The rational number.
 * @returns The fractional part as a rational in [0,1).
 */
function subtractFractional(r: Rational): Rational {
  const whole = Math.floor(r.numerator / r.denominator);
  return createRational(r.numerator - whole * r.denominator, r.denominator);
}
