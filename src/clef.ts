/**
 * The standard music notation clefs.
 *
 * `treble` and `bass` are the most common; `alto`, `tenor`, `soprano`, and
 * `mezzo-soprano` are C-clefs used for specific instruments and voice ranges;
 * `baritone` is an F-clef variant; `percussion` has no defined pitch reference.
 */
export type Clef =
  | 'treble'
  | 'bass'
  | 'alto'
  | 'tenor'
  | 'soprano'
  | 'mezzo-soprano'
  | 'baritone'
  | 'percussion';

/**
 * The frozen set of standard clef values.
 */
export const CLEFS: readonly Clef[] = Object.freeze([
  'treble',
  'bass',
  'alto',
  'tenor',
  'soprano',
  'mezzo-soprano',
  'baritone',
  'percussion',
] as const);
