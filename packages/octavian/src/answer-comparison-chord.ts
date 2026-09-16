// answer-comparison-chord.ts: Chord-specific comparison helper, split from
// answer-comparison.ts to stay within the 500-line limit.

import { Chord } from './chord.js';
import { Note } from './note.js';
import type { ComparisonRelationship } from './answer-comparison.js';

export type { ComparisonRelationship };

/**
 * The result of comparing two chords.
 */
export type ChordComparison = {
  /** Discriminant tag identifying the comparison kind. */
  readonly kind: 'chord';
  /** True when the chords are exactly equal (same root spelling, suffix, and inversion). */
  readonly correct: boolean;
  /** True when the chords share the same set of pitch classes (regardless of inversion). */
  readonly equivalent: boolean;
  /** A structured relationship token. */
  readonly relationship: ComparisonRelationship;
  /** True when both chords have the same suffix (quality + extensions). */
  readonly suffixMatch: boolean;
  /** True when both chord roots are enharmonically equivalent. */
  readonly rootMatch: boolean;
  /** True when both chord basses are enharmonically equivalent. */
  readonly bassMatch: boolean;
  /** True when both chords share the same inversion index. */
  readonly inversionMatch: boolean;
  /** Notes present in target but absent (by pitch class) from answer. */
  readonly missingChordTones: readonly Note[];
  /** Notes present in answer but absent (by pitch class) from target. */
  readonly extraChordTones: readonly Note[];
};

/**
 * Compares two chords by suffix, root, bass, inversion, and chord-tone diffs.
 *
 * @param target The expected chord.
 * @param answer The actual chord to compare.
 * @returns A structured {@link ChordComparison}.
 */
export function compareChords(target: Chord, answer: Chord): ChordComparison {
  const correct = target.equals(answer);
  const suffixMatch = target.suffix === answer.suffix;
  const rootMatch = target.root.isEnharmonicTo(answer.root);
  const bassMatch = target.bass.isEnharmonicTo(answer.bass);
  const inversionMatch = target.inversionIndex === answer.inversionIndex;

  // Pitch-class sets
  const targetPitchClasses = new Set(target.notes.map((n) => n.chromaticIndex));
  const answerPitchClasses = new Set(answer.notes.map((n) => n.chromaticIndex));

  // equivalent = same pitch-class set (inversion-agnostic)
  const equivalent = setsEqual(targetPitchClasses, answerPitchClasses);

  // missing: in target but not in answer (use first matching target note)
  const missingChordTones: Note[] = target.notes.filter(
    (n) => !answerPitchClasses.has(n.chromaticIndex),
  );

  // extra: in answer but not in target (use first matching answer note)
  const extraChordTones: Note[] = answer.notes.filter(
    (n) => !targetPitchClasses.has(n.chromaticIndex),
  );

  let relationship: ComparisonRelationship;
  if (correct) {
    relationship = 'exact';
  } else if (equivalent && !inversionMatch) {
    relationship = 'inversion-differs';
  } else if (equivalent && inversionMatch) {
    // Same pitch classes + same inversion but different root spelling
    relationship = 'enharmonic-equivalent';
  } else if (rootMatch && !suffixMatch) {
    relationship = 'quality-differs';
  } else {
    relationship = 'different';
  }

  return {
    kind: 'chord',
    correct,
    equivalent,
    relationship,
    suffixMatch,
    rootMatch,
    bassMatch,
    inversionMatch,
    missingChordTones: Object.freeze(missingChordTones),
    extraChordTones: Object.freeze(extraChordTones),
  };
}

function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}
