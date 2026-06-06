/**
 * An exact rational number represented as a reduced fraction with a positive denominator.
 *
 * All duration arithmetic uses this type to avoid floating-point drift.
 * For example, `1/12` (triplet eighth) is stored as `{numerator:1, denominator:12}` and
 * three of them sum to exactly `{numerator:1, denominator:4}` (one quarter note).
 */
export type Rational = {
  readonly numerator: number;
  readonly denominator: number;
};

/**
 * Returns the greatest common divisor of two non-negative integers using the Euclidean algorithm.
 *
 * @param a First non-negative integer.
 * @param b Second non-negative integer.
 * @returns The GCD.
 */
function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x;
}

/**
 * Creates a fully-reduced rational with a positive denominator.
 *
 * @param numerator The numerator (integer).
 * @param denominator The denominator (non-zero integer).
 * @returns The reduced rational number.
 * @throws {RangeError} When the denominator is zero or either value is not a finite integer.
 */
export function createRational(numerator: number, denominator: number): Rational {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new RangeError(
      `Expected integer numerator and denominator, received ${numerator}/${denominator}.`,
    );
  }

  if (denominator === 0) {
    throw new RangeError(`Denominator must be non-zero.`);
  }

  if (numerator === 0) {
    return { numerator: 0, denominator: 1 };
  }

  // Ensure denominator is positive by flipping sign of both if needed.
  const sign = denominator < 0 ? -1 : 1;
  const signedNumerator = numerator * sign;
  const absDenominator = Math.abs(denominator);
  const g = gcd(Math.abs(signedNumerator), absDenominator);

  return {
    numerator: signedNumerator / g,
    denominator: absDenominator / g,
  };
}

/**
 * Adds two rational numbers and returns the reduced result.
 *
 * @param a The first rational.
 * @param b The second rational.
 * @returns The sum as a reduced rational.
 */
export function addRationals(a: Rational, b: Rational): Rational {
  return createRational(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

/**
 * Subtracts rational `b` from rational `a` and returns the reduced result.
 *
 * @param a The minuend.
 * @param b The subtrahend.
 * @returns The difference as a reduced rational.
 */
export function subtractRationals(a: Rational, b: Rational): Rational {
  return createRational(
    a.numerator * b.denominator - b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

/**
 * Multiplies two rational numbers and returns the reduced result.
 *
 * @param a The first rational.
 * @param b The second rational.
 * @returns The product as a reduced rational.
 */
export function multiplyRationals(a: Rational, b: Rational): Rational {
  return createRational(a.numerator * b.numerator, a.denominator * b.denominator);
}

/**
 * Divides rational `a` by rational `b` and returns the reduced result.
 *
 * @param a The dividend.
 * @param b The divisor (must be non-zero).
 * @returns The quotient as a reduced rational.
 * @throws {RangeError} When `b` is zero.
 */
export function divideRationals(a: Rational, b: Rational): Rational {
  return createRational(a.numerator * b.denominator, a.denominator * b.numerator);
}

/**
 * Returns `true` when two rationals represent the same value after reduction.
 *
 * @param a The first rational.
 * @param b The second rational.
 * @returns `true` when the rationals are equal.
 */
export function rationalsEqual(a: Rational, b: Rational): boolean {
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

/**
 * Compares two rational numbers.
 *
 * @param a The first rational.
 * @param b The second rational.
 * @returns `-1` when `a < b`, `0` when equal, `1` when `a > b`.
 */
export function compareRationals(a: Rational, b: Rational): -1 | 0 | 1 {
  const diff = a.numerator * b.denominator - b.numerator * a.denominator;

  if (diff < 0) return -1;
  if (diff > 0) return 1;

  return 0;
}

/**
 * Returns `true` when the rational represents zero.
 *
 * @param r The rational to test.
 * @returns `true` when `r` equals zero.
 */
export function isZeroRational(r: Rational): boolean {
  return r.numerator === 0;
}

/**
 * Converts a rational to a decimal number (lossy — for display only).
 *
 * @param r The rational to convert.
 * @returns The decimal approximation.
 */
export function rationalToNumber(r: Rational): number {
  return r.numerator / r.denominator;
}

/**
 * Returns the rational formatted as a string `"numerator/denominator"` or `"numerator"` when denominator is 1.
 *
 * @param r The rational to format.
 * @returns The string representation.
 */
export function formatRational(r: Rational): string {
  if (r.denominator === 1) {
    return String(r.numerator);
  }

  return `${r.numerator}/${r.denominator}`;
}

/** The rational number zero. */
export const ZERO: Rational = { numerator: 0, denominator: 1 };

/** The rational number one (one whole note). */
export const ONE: Rational = { numerator: 1, denominator: 1 };
