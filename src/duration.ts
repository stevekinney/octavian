import {
  addRationals,
  createRational,
  formatRational,
  multiplyRationals,
  rationalsEqual,
  type Rational,
} from './rational.js';

// ---------------------------------------------------------------------------
// Duration value type
// ---------------------------------------------------------------------------

/**
 * The named base note-value for a duration, expressed in whole-note fractions.
 *
 * | Value         | Fraction |
 * |---------------|----------|
 * | `'double'`    | 2        |
 * | `'whole'`     | 1        |
 * | `'half'`      | 1/2      |
 * | `'quarter'`   | 1/4      |
 * | `'eighth'`    | 1/8      |
 * | `'sixteenth'` | 1/16     |
 * | `'thirtySecond'` | 1/32  |
 * | `'sixtyFourth'`  | 1/64  |
 */
export type DurationValue =
  | 'double'
  | 'whole'
  | 'half'
  | 'quarter'
  | 'eighth'
  | 'sixteenth'
  | 'thirtySecond'
  | 'sixtyFourth';

/**
 * Describes a tuplet ratio: `actual` notes in the time of `normal` notes.
 * For a standard triplet, `{ actual: 3, normal: 2 }`.
 */
export type TupletRatio = {
  /** The number of notes actually played. */
  readonly actual: number;
  /** The number of notes whose time is borrowed. */
  readonly normal: number;
};

/**
 * Options passed to {@link Duration.create}.
 */
export type DurationOptions = {
  /**
   * The number of augmentation dots (1–3). Each dot adds half the value of the preceding duration.
   * Defaults to `0`.
   */
  readonly dots?: number;
  /**
   * A tuplet ratio. The duration is multiplied by `normal / actual`.
   * For a standard triplet: `{ actual: 3, normal: 2 }`.
   */
  readonly tuplet?: TupletRatio;
  /**
   * When `true`, this duration represents a rest (silence) rather than a sounding note.
   * Defaults to `false`.
   */
  readonly isRest?: boolean;
  /**
   * When `true`, this duration is tied to the next event in a sequence.
   * Ties are a performance instruction; they do NOT change the written fraction.
   * Defaults to `false`.
   */
  readonly isTied?: boolean;
};

/**
 * A JSON-serializable snapshot of a duration.
 */
export type SerializedDuration = {
  readonly value: DurationValue;
  readonly dots: number;
  readonly tuplet: TupletRatio | null;
  readonly isRest: boolean;
  readonly isTied: boolean;
  readonly fraction: Rational;
};

// ---------------------------------------------------------------------------
// Lookup table: base fraction per named value
// ---------------------------------------------------------------------------

const BASE_FRACTIONS: Record<DurationValue, Rational> = {
  double: { numerator: 2, denominator: 1 },
  whole: { numerator: 1, denominator: 1 },
  half: { numerator: 1, denominator: 2 },
  quarter: { numerator: 1, denominator: 4 },
  eighth: { numerator: 1, denominator: 8 },
  sixteenth: { numerator: 1, denominator: 16 },
  thirtySecond: { numerator: 1, denominator: 32 },
  sixtyFourth: { numerator: 1, denominator: 64 },
};

const DURATION_VALUES: readonly DurationValue[] = [
  'double',
  'whole',
  'half',
  'quarter',
  'eighth',
  'sixteenth',
  'thirtySecond',
  'sixtyFourth',
];

/** @internal */
function isDurationValue(value: unknown): value is DurationValue {
  return typeof value === 'string' && DURATION_VALUES.includes(value as DurationValue);
}

// ---------------------------------------------------------------------------
// Dot and tuplet formulas
// ---------------------------------------------------------------------------

/**
 * Computes the dot multiplier: `(2^(d+1) - 1) / 2^d`.
 * d=1 → 3/2, d=2 → 7/4, d=3 → 15/8.
 *
 * @param dots Number of dots (1–3).
 * @returns The Rational multiplier.
 */
function dotMultiplier(dots: number): Rational {
  const power = 1 << dots; // 2^d
  return createRational((power << 1) - 1, power); // (2*power - 1) / power
}

/**
 * Applies augmentation dots to a base fraction.
 *
 * @param base The undotted duration fraction.
 * @param dots Number of dots (0–3).
 * @returns The dotted fraction.
 */
function applyDots(base: Rational, dots: number): Rational {
  if (dots === 0) return base;

  return multiplyRationals(base, dotMultiplier(dots));
}

/**
 * Applies a tuplet ratio to a dotted base fraction.
 *
 * @param base The (optionally dotted) base fraction.
 * @param tuplet The tuplet ratio `{ actual, normal }`.
 * @returns The tuplet-adjusted fraction.
 */
function applyTuplet(base: Rational, tuplet: TupletRatio): Rational {
  return multiplyRationals(base, createRational(tuplet.normal, tuplet.actual));
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Validation helpers — extracted to keep Duration.create complexity ≤ 10
// ---------------------------------------------------------------------------

function validateDots(dots: number): void {
  if (!Number.isInteger(dots) || dots < 0 || dots > 3) {
    throw new RangeError(`Expected dots in the range 0..3, received ${dots}.`);
  }
}

function validateTuplet(tuplet: TupletRatio): void {
  if (
    !Number.isInteger(tuplet.actual) ||
    !Number.isInteger(tuplet.normal) ||
    tuplet.actual <= 0 ||
    tuplet.normal <= 0
  ) {
    throw new RangeError(
      `Tuplet actual and normal must be positive integers, received ${tuplet.actual}:${tuplet.normal}.`,
    );
  }
}

function computeFraction(value: DurationValue, dots: number, tuplet: TupletRatio | null): Rational {
  const base = BASE_FRACTIONS[value];
  const dotted = applyDots(base, dots);

  return tuplet !== null ? applyTuplet(dotted, tuplet) : dotted;
}

// ---------------------------------------------------------------------------
// Module-scoped factory — populated by Duration.static {}
// ---------------------------------------------------------------------------

let createDuration: (
  value: DurationValue,
  fraction: Rational,
  dots: number,
  tuplet: TupletRatio | null,
  isRest: boolean,
  isTied: boolean,
) => Duration;

// ---------------------------------------------------------------------------
// Duration value object
// ---------------------------------------------------------------------------

/**
 * An immutable musical duration with exact rational arithmetic.
 *
 * All durations are expressed as fractions of a whole note, stored as exact {@link Rational}
 * values to prevent floating-point drift. Three triplet-eighths equal exactly one quarter note.
 *
 * Ties are modelled as a metadata flag on the duration — they carry no extra fraction.
 * Rests replace sounding notes but share the same time semantics.
 */
export class Duration {
  readonly #value: DurationValue;
  readonly #fraction: Rational;
  readonly #dots: number;
  readonly #tuplet: TupletRatio | null;
  readonly #isRest: boolean;
  readonly #isTied: boolean;

  /** @internal Use {@link Duration.create} instead. */
  protected constructor(
    value: DurationValue,
    fraction: Rational,
    dots: number,
    tuplet: TupletRatio | null,
    isRest: boolean,
    isTied: boolean,
  ) {
    this.#value = value;
    this.#fraction = fraction;
    this.#dots = dots;
    this.#tuplet = tuplet;
    this.#isRest = isRest;
    this.#isTied = isTied;
  }

  static {
    createDuration = (
      value: DurationValue,
      fraction: Rational,
      dots: number,
      tuplet: TupletRatio | null,
      isRest: boolean,
      isTied: boolean,
    ): Duration => new Duration(value, fraction, dots, tuplet, isRest, isTied);
  }

  /**
   * Creates an immutable duration from a named value and optional modifiers.
   *
   * @param value The base note value.
   * @param options Optional dots, tuplet, rest, and tie flags.
   * @returns The created duration.
   * @throws {TypeError} When `value` is not a recognized duration value.
   * @throws {RangeError} When `dots` is not in `0..3` or tuplet values are invalid.
   */
  public static create(value: DurationValue, options: DurationOptions = {}): Duration {
    if (!isDurationValue(value)) {
      throw new TypeError(`Unsupported duration value: ${String(value)}.`);
    }

    const dots = options.dots ?? 0;
    validateDots(dots);

    const tuplet = options.tuplet ?? null;
    if (tuplet !== null) validateTuplet(tuplet);

    const fraction = computeFraction(value, dots, tuplet);
    const isRest = options.isRest ?? false;
    const isTied = options.isTied ?? false;

    return createDuration(value, fraction, dots, tuplet, isRest, isTied);
  }

  /**
   * Recreates a duration from serialized data.
   *
   * @param serialized The serialized duration.
   * @returns The recreated duration.
   * @throws {TypeError} When the serialized fraction does not match the recomputed fraction.
   */
  public static fromJSON(serialized: SerializedDuration): Duration {
    const base: DurationOptions = {
      dots: serialized.dots,
      isRest: serialized.isRest,
      isTied: serialized.isTied,
    };
    const options: DurationOptions =
      serialized.tuplet !== null ? { ...base, tuplet: serialized.tuplet } : base;
    const duration = Duration.create(serialized.value, options);

    if (!rationalsEqual(duration.fraction(), serialized.fraction)) {
      throw new TypeError(
        `Serialized fraction ${formatRational(serialized.fraction)} does not match recomputed ${formatRational(duration.fraction())}.`,
      );
    }

    return duration;
  }

  /**
   * The named base note value.
   */
  public get value(): DurationValue {
    return this.#value;
  }

  /**
   * The number of augmentation dots.
   */
  public get dots(): number {
    return this.#dots;
  }

  /**
   * The tuplet ratio, or `null` when not a tuplet.
   */
  public get tuplet(): TupletRatio | null {
    return this.#tuplet;
  }

  /**
   * Whether this duration represents a rest.
   */
  public get isRest(): boolean {
    return this.#isRest;
  }

  /**
   * Whether this duration is tied to the next event.
   * Ties are a notation/performance flag — the written fraction is unchanged.
   */
  public get isTied(): boolean {
    return this.#isTied;
  }

  /**
   * Returns the exact duration as a fraction of a whole note.
   *
   * @returns The exact rational duration fraction.
   */
  public fraction(): Rational {
    return this.#fraction;
  }

  /**
   * Returns the duration in beats, given a beat unit expressed as a whole-note fraction.
   *
   * For 4/4 time the beat unit is a quarter note (1/4).
   * For 6/8 time the beat unit is a dotted-quarter (3/8).
   *
   * @param beatUnit The fraction of a whole note that equals one beat. Defaults to a quarter note (`{numerator:1, denominator:4}`).
   * @returns The duration expressed in beats.
   */
  public beats(beatUnit: Rational = { numerator: 1, denominator: 4 }): Rational {
    return multiplyRationals(this.#fraction, {
      numerator: beatUnit.denominator,
      denominator: beatUnit.numerator,
    });
  }

  /**
   * Returns a new duration identical to this one but flagged as a rest.
   *
   * @returns A rest version of this duration.
   */
  public asRest(): Duration {
    return createDuration(
      this.#value,
      this.#fraction,
      this.#dots,
      this.#tuplet,
      true,
      this.#isTied,
    );
  }

  /**
   * Returns a new duration identical to this one but with the tie flag toggled.
   *
   * @param tied Whether to enable the tie flag.
   * @returns The duration with the tie flag set.
   */
  public withTie(tied: boolean): Duration {
    return createDuration(
      this.#value,
      this.#fraction,
      this.#dots,
      this.#tuplet,
      this.#isRest,
      tied,
    );
  }

  /**
   * Returns `true` when another duration has the same written fraction, rest, and tie state.
   *
   * @param other The duration to compare.
   * @returns `true` when the durations are equal.
   */
  public equals(other: Duration): boolean {
    const sameFraction = rationalsEqual(this.#fraction, other.fraction());
    const sameRest = this.#isRest === other.isRest;
    const sameTied = this.#isTied === other.isTied;

    return sameFraction && sameRest && sameTied;
  }

  /**
   * Returns the human-readable duration label.
   *
   * @returns The label string.
   */
  public toString(): string {
    const dots = '.'.repeat(this.#dots);
    const tupletSuffix =
      this.#tuplet !== null ? ` [${this.#tuplet.actual}:${this.#tuplet.normal}]` : '';
    const restSuffix = this.#isRest ? ' rest' : '';
    const tiedSuffix = this.#isTied ? '~' : '';

    return `${this.#value}${dots}${tupletSuffix}${restSuffix}${tiedSuffix}`;
  }

  /**
   * Serializes the duration to JSON-safe data.
   *
   * @returns The serialized duration.
   */
  public toJSON(): SerializedDuration {
    return {
      value: this.#value,
      dots: this.#dots,
      tuplet: this.#tuplet,
      isRest: this.#isRest,
      isTied: this.#isTied,
      fraction: this.#fraction,
    };
  }

  /**
   * Returns the custom `Object.prototype.toString` tag.
   */
  public get [Symbol.toStringTag](): string {
    return `Duration(${this.toString()})`;
  }
}

/**
 * Sums an array of duration fractions and returns the total as an exact rational.
 *
 * @param durations The durations to sum.
 * @returns The total duration as a whole-note fraction.
 */
export function totalDurationFraction(durations: readonly Duration[]): Rational {
  let total: Rational = { numerator: 0, denominator: 1 };

  for (const duration of durations) {
    total = addRationals(total, duration.fraction());
  }

  return total;
}
