// figured-bass-figures.ts: leaf module holding the inversion → figure
// stack mapping. Lives separately from `figured-bass.ts` so that
// `chord.ts` can import the pure mapping for its `figuredBass()`
// delegator without pulling in the full figured-bass module (which
// imports `Chord` and `Key`, creating a static circular import).

/**
 * The chromatic alteration attached to a single figured-bass figure.
 */
export type FiguredBassAccidental = 'sharp' | 'flat' | 'natural';

/**
 * The numeric digit on a figured-bass figure (1..9 in common practice).
 */
export type FiguredBassDigit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * A single figure in a figured-bass stack: a digit plus an optional
 * chromatic alteration.
 */
export type FiguredBassFigure = {
  readonly digit: FiguredBassDigit;
  readonly accidental?: FiguredBassAccidental;
};

/**
 * A stacked figured-bass annotation, ordered top-to-bottom.
 */
export type FiguredBass = readonly FiguredBassFigure[];

/**
 * The standard figured-bass inversion shorthands.
 */
export type FiguredBassInversion = '5/3' | '6' | '6/4' | '7' | '6/5' | '4/3' | '4/2';

/**
 * The kind of chord cardinality that figured-bass figures address:
 * `'triad'` (3 chord tones) or `'seventh'` (4 chord tones).
 */
export type FiguredBassChordKind = 'triad' | 'seventh';

/**
 * Valid inversion indices for a figured-bass-tagged chord. Triads
 * accept 0..2 (root, first, second); sevenths accept 0..3.
 */
export type FiguredBassInversionIndex = 0 | 1 | 2 | 3;

// The lookup tables are deep-frozen so callers can't mutate the
// shared module-level data through the `readonly` arrays returned
// from `figuredBassForCardinality`. The `readonly` modifier is a
// compile-time-only constraint; freezing makes the immutability
// stick at runtime.
const TRIAD_FIGURES_BY_INVERSION: Readonly<Record<0 | 1 | 2, FiguredBass>> = Object.freeze({
  0: Object.freeze([]) as FiguredBass, // 5/3 is implicit; the conventional notation is to omit it.
  1: Object.freeze([Object.freeze({ digit: 6 } as const)]),
  2: Object.freeze([Object.freeze({ digit: 6 } as const), Object.freeze({ digit: 4 } as const)]),
});

const SEVENTH_FIGURES_BY_INVERSION: Readonly<Record<0 | 1 | 2 | 3, FiguredBass>> = Object.freeze({
  0: Object.freeze([Object.freeze({ digit: 7 } as const)]),
  1: Object.freeze([Object.freeze({ digit: 6 } as const), Object.freeze({ digit: 5 } as const)]),
  2: Object.freeze([Object.freeze({ digit: 4 } as const), Object.freeze({ digit: 3 } as const)]),
  3: Object.freeze([Object.freeze({ digit: 4 } as const), Object.freeze({ digit: 2 } as const)]),
});

/**
 * Returns the figured-bass figure stack for the given chord
 * cardinality and inversion. The result is the *short* common-practice
 * form — for a root-position triad it is the empty stack (the implicit
 * `5/3`); for a first-inversion triad it is `[{ digit: 6 }]`, not
 * `[{ digit: 6 }, { digit: 3 }]`.
 *
 * Triads accept inversions 0..2; sevenths accept 0..3. Callers are
 * responsible for narrowing `inversion` to a valid range for `kind`
 * before calling — `chord.ts` and `figured-bass.ts` both do so by
 * gating on `chord.intervals.length` first.
 */
export function figuredBassForCardinality(
  kind: FiguredBassChordKind,
  inversion: FiguredBassInversionIndex,
): FiguredBass {
  if (kind === 'triad') {
    return TRIAD_FIGURES_BY_INVERSION[narrowTriadInversion(inversion)];
  }
  return SEVENTH_FIGURES_BY_INVERSION[inversion];
}

/**
 * Returns the figured-bass inversion shorthand for the given
 * cardinality and inversion.
 */
export function figuredBassInversionForCardinality(
  kind: FiguredBassChordKind,
  inversion: FiguredBassInversionIndex,
): FiguredBassInversion {
  if (kind === 'triad') {
    return TRIAD_INVERSION_SHORTHANDS[narrowTriadInversion(inversion)];
  }
  return SEVENTH_INVERSION_SHORTHANDS[inversion];
}

const TRIAD_INVERSION_SHORTHANDS: Readonly<Record<0 | 1 | 2, FiguredBassInversion>> = {
  0: '5/3',
  1: '6',
  2: '6/4',
};

const SEVENTH_INVERSION_SHORTHANDS: Readonly<Record<0 | 1 | 2 | 3, FiguredBassInversion>> = {
  0: '7',
  1: '6/5',
  2: '4/3',
  3: '4/2',
};

function narrowTriadInversion(inversion: FiguredBassInversionIndex): 0 | 1 | 2 {
  if (inversion === 3) {
    throw new RangeError('Triads accept inversions 0..2; received 3.');
  }
  return inversion;
}
