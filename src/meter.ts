import { createRational, type Rational } from './rational.js';

// ---------------------------------------------------------------------------
// Meter classification
// ---------------------------------------------------------------------------

/**
 * Simple meters have a numerator of 2, 3, or 4.
 * Compound meters have a numerator that is a multiple of 3 greater than 3 (i.e. 6, 9, 12).
 * All other numerators are asymmetric (e.g. 5, 7, 11).
 */
export type MeterType = 'simple' | 'compound' | 'asymmetric';

const SIMPLE_NUMERATORS = new Set([2, 3, 4]);
const COMPOUND_NUMERATORS = new Set([6, 9, 12]);
const VALID_DENOMINATORS = new Set([1, 2, 4, 8, 16, 32, 64]);

/**
 * A JSON-serializable snapshot of a meter.
 */
export type SerializedMeter = {
  readonly numerator: number;
  readonly denominator: number;
};

// ---------------------------------------------------------------------------
// Module-scoped factory — populated by Meter.static {}
// ---------------------------------------------------------------------------

let createMeter: (numerator: number, denominator: number) => Meter;

// ---------------------------------------------------------------------------
// Meter value object
// ---------------------------------------------------------------------------

/**
 * An immutable musical meter (time signature) with exact rational beat arithmetic.
 *
 * Time signatures are classified as:
 * - **simple**: numerator ∈ {2, 3, 4} — one undivided pulse per beat (e.g. 4/4, 3/4, 2/2)
 * - **compound**: numerator ∈ {6, 9, 12} — three subdivisions per beat (e.g. 6/8, 9/8, 12/8)
 * - **asymmetric**: all others — irregular groupings (e.g. 5/4, 7/8, 11/8)
 *
 * The beat unit for simple and asymmetric meters is `1/denominator`.
 * For compound meters the beat unit is `3/denominator` (a dotted note value).
 *
 * All measure and beat quantities use exact {@link Rational} arithmetic.
 */
export class Meter {
  readonly #numerator: number;
  readonly #denominator: number;
  readonly #type: MeterType;
  readonly #beatsPerMeasure: number;
  readonly #beatUnit: Rational;
  readonly #measureDuration: Rational;

  /** @internal Use {@link Meter.create} or {@link Meter.fromJSON} instead. */
  protected constructor(numerator: number, denominator: number) {
    if (!Number.isInteger(numerator) || numerator <= 0) {
      throw new RangeError(`Expected a positive integer numerator, received ${numerator}.`);
    }

    if (!VALID_DENOMINATORS.has(denominator)) {
      throw new RangeError(
        `Expected a power-of-two denominator (1,2,4,8,16,32,64), received ${denominator}.`,
      );
    }

    this.#numerator = numerator;
    this.#denominator = denominator;

    if (SIMPLE_NUMERATORS.has(numerator)) {
      this.#type = 'simple';
      this.#beatsPerMeasure = numerator;
      this.#beatUnit = createRational(1, denominator);
    } else if (COMPOUND_NUMERATORS.has(numerator)) {
      this.#type = 'compound';
      this.#beatsPerMeasure = numerator / 3;
      this.#beatUnit = createRational(3, denominator);
    } else {
      this.#type = 'asymmetric';
      this.#beatsPerMeasure = numerator;
      this.#beatUnit = createRational(1, denominator);
    }

    this.#measureDuration = createRational(numerator, denominator);
  }

  static {
    createMeter = (numerator: number, denominator: number): Meter =>
      new Meter(numerator, denominator);
  }

  /**
   * Creates a meter from either a time-signature string (`'4/4'`) or separate numerator/denominator integers.
   *
   * @param numeratorOrSignature The numerator or a `'numerator/denominator'` string.
   * @param denominator The denominator, required when passing a numerator integer.
   * @returns The created meter.
   * @throws {TypeError} When the string is not in `'numerator/denominator'` format.
   * @throws {RangeError} When the numerator is not a positive integer or the denominator is not a power of two.
   */
  public static create(numeratorOrSignature: number | string, denominator?: number): Meter {
    if (typeof numeratorOrSignature === 'string') {
      return Meter.fromString(numeratorOrSignature);
    }

    if (denominator === undefined) {
      throw new TypeError(
        `Expected a denominator when passing a numerator integer, received undefined.`,
      );
    }

    return createMeter(numeratorOrSignature, denominator);
  }

  /**
   * Parses a time-signature string of the form `'numerator/denominator'`.
   *
   * @param signature The time signature string.
   * @returns The parsed meter.
   * @throws {TypeError} When the string format is invalid.
   */
  private static fromString(signature: string): Meter {
    const parts = signature.split('/');

    if (parts.length !== 2) {
      throw new TypeError(
        `Expected a time signature string of the form 'numerator/denominator', received ${JSON.stringify(signature)}.`,
      );
    }

    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const rawNumerator = parts[0]!;
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const rawDenominator = parts[1]!;

    if (!/^\d+$/.test(rawNumerator) || !/^\d+$/.test(rawDenominator)) {
      throw new TypeError(
        `Expected a time signature string of the form 'numerator/denominator', received ${JSON.stringify(signature)}.`,
      );
    }

    const numerator = parseInt(rawNumerator, 10);
    const denominator = parseInt(rawDenominator, 10);

    return createMeter(numerator, denominator);
  }

  /**
   * Recreates a meter from serialized data.
   *
   * @param serialized The serialized meter.
   * @returns The recreated meter.
   */
  public static fromJSON(serialized: SerializedMeter): Meter {
    return createMeter(serialized.numerator, serialized.denominator);
  }

  /**
   * The top number of the time signature.
   */
  public get numerator(): number {
    return this.#numerator;
  }

  /**
   * The bottom number of the time signature.
   */
  public get denominator(): number {
    return this.#denominator;
  }

  /**
   * The meter classification: `'simple'`, `'compound'`, or `'asymmetric'`.
   */
  public get type(): MeterType {
    return this.#type;
  }

  /**
   * The number of beats per measure.
   * For compound meters this is `numerator / 3`; for all others it is `numerator`.
   */
  public get beatsPerMeasure(): number {
    return this.#beatsPerMeasure;
  }

  /**
   * The beat unit expressed as a whole-note fraction.
   * Simple/asymmetric: `1/denominator`. Compound: `3/denominator` (a dotted note).
   */
  public get beatUnit(): Rational {
    return this.#beatUnit;
  }

  /**
   * The total measure duration as a whole-note fraction.
   * For 4/4 this is `1`. For 6/8 this is `3/4`.
   */
  public get measureDuration(): Rational {
    return this.#measureDuration;
  }

  /**
   * Returns `true` when the meter is simple (numerator ∈ {2, 3, 4}).
   *
   * @returns `true` for simple meters.
   */
  public isSimple(): boolean {
    return this.#type === 'simple';
  }

  /**
   * Returns `true` when the meter is compound (numerator ∈ {6, 9, 12}).
   *
   * @returns `true` for compound meters.
   */
  public isCompound(): boolean {
    return this.#type === 'compound';
  }

  /**
   * Returns `true` when the meter is asymmetric (all other numerators).
   *
   * @returns `true` for asymmetric meters.
   */
  public isAsymmetric(): boolean {
    return this.#type === 'asymmetric';
  }

  /**
   * Returns `true` when another meter has the same numerator and denominator.
   *
   * @param other The meter to compare.
   * @returns `true` when the meters are equal.
   */
  public equals(other: Meter): boolean {
    return this.#numerator === other.numerator && this.#denominator === other.denominator;
  }

  /**
   * Returns the time-signature string.
   *
   * @returns The time signature, e.g. `'4/4'`.
   */
  public toString(): string {
    return `${this.#numerator}/${this.#denominator}`;
  }

  /**
   * Serializes the meter to JSON-safe data.
   *
   * @returns The serialized meter.
   */
  public toJSON(): SerializedMeter {
    return {
      numerator: this.#numerator,
      denominator: this.#denominator,
    };
  }

  /**
   * Returns the custom `Object.prototype.toString` tag.
   */
  public get [Symbol.toStringTag](): string {
    return `Meter(${this.toString()})`;
  }

  /**
   * Returns `true` when a duration fraction fits an exact number of measures in this meter.
   *
   * @param totalFraction The total duration as a whole-note fraction.
   * @returns `true` when the duration fills a positive integer number of complete measures.
   */
  public fitsExactly(totalFraction: Rational): boolean {
    // measures = totalFraction / measureDuration = totalFraction * (denominator / numerator)
    const measures = {
      numerator: totalFraction.numerator * this.#denominator,
      denominator: totalFraction.denominator * this.#numerator,
    };
    // Reduce and check denominator === 1 (whole number) and numerator > 0.
    const g = gcdPositive(Math.abs(measures.numerator), measures.denominator);
    const reducedNumerator = measures.numerator / g;
    const reducedDenominator = measures.denominator / g;

    return reducedDenominator === 1 && reducedNumerator > 0;
  }
}

/**
 * Returns `true` when two meters are equal.
 *
 * @param a The first meter.
 * @param b The second meter.
 * @returns `true` when numerator and denominator match.
 */
export function metersEqual(a: Meter, b: Meter): boolean {
  return a.equals(b);
}

// ---------------------------------------------------------------------------
// Private utilities
// ---------------------------------------------------------------------------

function gcdPositive(a: number, b: number): number {
  let x = a;
  let y = b;

  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x;
}
