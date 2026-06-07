// answer-comparison.ts: Structured comparison helpers over Note, Interval,
// ScaleDegreeAnalysis, and RomanNumeral. Chord comparison lives in
// answer-comparison-chord.ts to stay within the 500-line limit.

import { INTERVALS, invertInterval, resolveInterval, type Interval } from './intervals.js';
import { Note, type NoteLike } from './note.js';
import { RomanNumeral } from './roman-numeral.js';
import {
  type ScaleDegreeAlteration,
  type ScaleDegreeAnalysis,
  type KeyOrScale,
  degreeForNote,
} from './scale-degree.js';
import { Chord } from './chord.js';
import { compareChords, type ChordComparison } from './answer-comparison-chord.js';

export type { ChordComparison };

// ---------------------------------------------------------------------------
// Shared relationship token
// ---------------------------------------------------------------------------

/**
 * A structured token describing how a target and answer relate.
 *
 * - `'exact'` — identical in spelling, register, and inversion.
 * - `'enharmonic-equivalent'` — same pitch / pitch set, different spelling.
 * - `'pitch-class-equal'` — same pitch class(es), different register.
 * - `'near-miss'` — small difference (≤ 2 semitones for intervals; degree/alteration off by 1 for scale degrees).
 * - `'quality-differs'` — same root / degree but different quality.
 * - `'inversion-differs'` — same pitch content, different inversion / bass.
 * - `'alteration-differs'` — same degree, different chromatic alteration.
 * - `'different'` — no recognised close relationship.
 */
export type ComparisonRelationship =
  | 'exact'
  | 'enharmonic-equivalent'
  | 'pitch-class-equal'
  | 'near-miss'
  | 'quality-differs'
  | 'inversion-differs'
  | 'alteration-differs'
  | 'different';

// ---------------------------------------------------------------------------
// NoteComparison
// ---------------------------------------------------------------------------

/**
 * The result of comparing two notes.
 */
export type NoteComparison = {
  /** True when the notes share the same spelling and octave. */
  readonly correct: boolean;
  /** True when the notes share the same MIDI pitch (enharmonic). */
  readonly equivalent: boolean;
  /** A structured relationship token. */
  readonly relationship: ComparisonRelationship;
  /** True when the notes are enharmonically equivalent (same MIDI). */
  readonly enharmonicMatch: boolean;
  /** True when the notes share the same pitch class (octave-agnostic). */
  readonly pitchClassMatch: boolean;
  /** True when the notes are in different registers (different octave). */
  readonly registerDiffers: boolean;
  /** The signed semitone distance from target to answer (positive = answer is higher). */
  readonly semitoneDifference: number;
};

/**
 * Compares two note-like values by spelling, enharmonic equivalence, pitch
 * class, and register.
 *
 * @param target The expected note.
 * @param answer The actual note to compare.
 * @returns A structured {@link NoteComparison}.
 */
export function compareNotes(target: NoteLike, answer: NoteLike): NoteComparison {
  const t = Note.create(target);
  const a = Note.create(answer);

  const correct = t.equals(a);
  const enharmonicMatch = t.isEnharmonicTo(a);
  const pitchClassMatch = t.chromaticIndex === a.chromaticIndex;
  const registerDiffers = t.octave !== a.octave;
  const semitoneDifference = Number(a.midi) - Number(t.midi);

  // `equivalent` = same sounding pitch (enharmonicMatch implies same octave+pitch)
  const equivalent = enharmonicMatch;

  let relationship: ComparisonRelationship;
  if (correct) {
    relationship = 'exact';
  } else if (enharmonicMatch) {
    relationship = 'enharmonic-equivalent';
  } else if (pitchClassMatch) {
    // Same pitch class but different octave
    relationship = 'pitch-class-equal';
  } else {
    relationship = 'different';
  }

  return {
    correct,
    equivalent,
    relationship,
    enharmonicMatch,
    pitchClassMatch,
    registerDiffers,
    semitoneDifference,
  };
}

// ---------------------------------------------------------------------------
// IntervalComparison
// ---------------------------------------------------------------------------

/**
 * The result of comparing two intervals.
 */
export type IntervalComparison = {
  /** True when both intervals are the canonical same interval. */
  readonly correct: boolean;
  /** True when both intervals span the same number of semitones (enharmonic intervals). */
  readonly equivalent: boolean;
  /** A structured relationship token. */
  readonly relationship: ComparisonRelationship;
  /** The absolute difference in semitones between the two intervals (always ≥ 0). */
  readonly semitoneDifference: number;
  /** The difference in interval degree (answer.degree − target.degree). */
  readonly degreeDifference: number;
  /** True when both intervals have the same quality (e.g. both 'major'). */
  readonly qualityMatch: boolean;
  /** True when the answer is the inversion of the target. */
  readonly inversionMatch: boolean;
};

/**
 * Compares two intervals by canonical name, semitones, quality, degree, and
 * inversion.
 *
 * @param target The expected interval.
 * @param answer The actual interval to compare.
 * @returns A structured {@link IntervalComparison}.
 */
export function compareIntervals(target: Interval, answer: Interval): IntervalComparison {
  const canonicalTarget = resolveInterval(target);
  const canonicalAnswer = resolveInterval(answer);

  const targetInfo = INTERVALS[canonicalTarget];
  const answerInfo = INTERVALS[canonicalAnswer];

  const correct = canonicalTarget === canonicalAnswer;
  const semitoneDifference = Math.abs(answerInfo.semitones - targetInfo.semitones);
  const degreeDifference = answerInfo.degree - targetInfo.degree;
  const qualityMatch = targetInfo.quality === answerInfo.quality;
  // equivalent = same semitone count (enharmonic intervals like M3 vs d4)
  const equivalent = correct || semitoneDifference === 0;

  // Inversion: answer is the inversion of target (e.g. P4 ↔ P5, M3 ↔ m6).
  let inversionMatch = false;
  try {
    inversionMatch = invertInterval(canonicalTarget) === canonicalAnswer;
  } catch {
    // No inversion defined for this interval — leave false.
  }

  let relationship: ComparisonRelationship;
  if (correct) {
    relationship = 'exact';
  } else if (equivalent) {
    relationship = 'enharmonic-equivalent';
  } else if (inversionMatch) {
    relationship = 'inversion-differs';
  } else if (Math.abs(semitoneDifference) <= 2) {
    relationship = 'near-miss';
  } else if (qualityMatch) {
    relationship = 'different';
  } else {
    relationship = 'quality-differs';
  }

  return {
    correct,
    equivalent,
    relationship,
    semitoneDifference,
    degreeDifference,
    qualityMatch,
    inversionMatch,
  };
}

// ---------------------------------------------------------------------------
// ScaleDegreeComparison
// ---------------------------------------------------------------------------

/**
 * The result of comparing two scale degrees within a context.
 */
export type ScaleDegreeComparison = {
  /** True when degree number AND alteration match exactly. */
  readonly correct: boolean;
  /** True when the notes are enharmonically equivalent (same chromatic index from tonic). */
  readonly equivalent: boolean;
  /** A structured relationship token. */
  readonly relationship: ComparisonRelationship;
  /** The target degree label, e.g. `'b3'` or `'4'`. */
  readonly targetLabel: string;
  /** The answer degree label, e.g. `'3'`. */
  readonly answerLabel: string;
  /** Difference in degree number (answer.degree − target.degree). */
  readonly degreeDifference: number;
  /** True when the degree numbers match but alterations differ. */
  readonly alterationDiffers: boolean;
  /** The difference in semitones from tonic (answer.semitoneFromTonic − target.semitoneFromTonic), in −11..11. */
  readonly semitoneDifference: number;
};

function alterationLabel(alteration: ScaleDegreeAlteration, degree: number): string {
  return `${alteration}${degree}`;
}

function compareAnalyses(
  targetAnalysis: ScaleDegreeAnalysis,
  answerAnalysis: ScaleDegreeAnalysis,
): ScaleDegreeComparison {
  const correct =
    targetAnalysis.degree === answerAnalysis.degree &&
    targetAnalysis.alteration === answerAnalysis.alteration;

  // equivalent = same chromatic distance from tonic
  const equivalent = targetAnalysis.semitoneFromTonic === answerAnalysis.semitoneFromTonic;

  const degreeDifference = answerAnalysis.degree - targetAnalysis.degree;
  const alterationDiffers =
    targetAnalysis.degree === answerAnalysis.degree &&
    targetAnalysis.alteration !== answerAnalysis.alteration;

  // Raw signed semitone difference (not modular, can be negative)
  const semitoneDifference = answerAnalysis.semitoneFromTonic - targetAnalysis.semitoneFromTonic;

  const targetLabel = alterationLabel(targetAnalysis.alteration, targetAnalysis.degree);
  const answerLabel = alterationLabel(answerAnalysis.alteration, answerAnalysis.degree);

  let relationship: ComparisonRelationship;
  if (correct) {
    relationship = 'exact';
  } else if (equivalent) {
    // Enharmonic re-spelling of same pitch-class-from-tonic
    relationship = 'enharmonic-equivalent';
  } else if (alterationDiffers) {
    relationship = 'alteration-differs';
  } else if (Math.abs(degreeDifference) <= 1 || Math.abs(semitoneDifference) <= 1) {
    relationship = 'near-miss';
  } else {
    relationship = 'different';
  }

  return {
    correct,
    equivalent,
    relationship,
    targetLabel,
    answerLabel,
    degreeDifference,
    alterationDiffers,
    semitoneDifference,
  };
}

/**
 * Compares two notes as scale degrees within a key or scale context.
 *
 * @param context The key or scale providing the diatonic reference.
 * @param target The expected note (or note-like value).
 * @param answer The actual note to compare.
 * @returns A structured {@link ScaleDegreeComparison}.
 * @throws {RangeError} When the context is not a heptatonic (7-note) scale.
 */
export function compareScaleDegrees(
  context: KeyOrScale,
  target: NoteLike,
  answer: NoteLike,
): ScaleDegreeComparison {
  const targetAnalysis = degreeForNote(context, target);
  const answerAnalysis = degreeForNote(context, answer);

  if (targetAnalysis === null || answerAnalysis === null) {
    throw new RangeError('compareScaleDegrees requires a heptatonic (7-note) scale context.');
  }

  return compareAnalyses(targetAnalysis, answerAnalysis);
}

// ---------------------------------------------------------------------------
// RomanNumeralComparison
// ---------------------------------------------------------------------------

/**
 * The result of comparing two Roman numerals.
 */
export type RomanNumeralComparison = {
  /** True when all fields match exactly (degree, quality, inversion, alteration, applied). */
  readonly correct: boolean;
  /** True when the degree and quality match (ignoring inversion and applied). */
  readonly equivalent: boolean;
  /** A structured relationship token. */
  readonly relationship: ComparisonRelationship;
  /** Difference in scale degree (answer.degree − target.degree). */
  readonly degreeDifference: number;
  /** True when the inversions match. */
  readonly inversionMatch: boolean;
  /** True when the qualities match. */
  readonly qualityMatch: boolean;
};

/**
 * Compares two Roman numeral chord symbols.
 *
 * @param target The expected Roman numeral.
 * @param answer The actual Roman numeral to compare.
 * @returns A structured {@link RomanNumeralComparison}.
 */
export function compareRomanNumerals(
  target: RomanNumeral,
  answer: RomanNumeral,
): RomanNumeralComparison {
  const correct = target.equals(answer);
  const qualityMatch = target.quality === answer.quality;
  const inversionMatch = target.inversion === answer.inversion;
  const degreeDifference = answer.degree - target.degree;

  // equivalent = same degree and quality (ignoring inversion / applied)
  const equivalent = target.degree === answer.degree && qualityMatch;

  let relationship: ComparisonRelationship;
  if (correct) {
    relationship = 'exact';
  } else if (equivalent && !inversionMatch) {
    relationship = 'inversion-differs';
  } else if (target.degree === answer.degree && !qualityMatch) {
    relationship = 'quality-differs';
  } else if (Math.abs(degreeDifference) <= 1) {
    relationship = 'near-miss';
  } else {
    relationship = 'different';
  }

  return { correct, equivalent, relationship, degreeDifference, inversionMatch, qualityMatch };
}

// ---------------------------------------------------------------------------
// AnswerComparison dispatcher
// ---------------------------------------------------------------------------

/**
 * The union result type returned by {@link compareMusicAnswer}.
 */
export type AnswerComparison =
  | NoteComparison
  | IntervalComparison
  | ChordComparison
  | ScaleDegreeComparison
  | RomanNumeralComparison;

/**
 * The accepted target/answer types for {@link compareMusicAnswer}.
 */
export type MusicAnswerTarget =
  | Note
  | NoteLike
  | Interval
  | Chord
  | ScaleDegreeAnalysis
  | RomanNumeral;

function describeValue(value: MusicAnswerTarget): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    if (value instanceof Note) return value.toString();
    if (value instanceof Chord) return value.name;
    if (value instanceof RomanNumeral) return value.toString();
    return JSON.stringify(value);
  }
  return String(value);
}

function isScaleDegreeAnalysis(value: MusicAnswerTarget): value is ScaleDegreeAnalysis {
  return (
    typeof value === 'object' &&
    value !== null &&
    'semitoneFromTonic' in value &&
    'degree' in value &&
    'alteration' in value
  );
}

function dispatchRomanNumeral(
  target: RomanNumeral,
  answer: MusicAnswerTarget,
): RomanNumeralComparison {
  if (!(answer instanceof RomanNumeral)) {
    throw new TypeError(
      `compareMusicAnswer: target is a RomanNumeral but answer is not: ${describeValue(answer)}.`,
    );
  }
  return compareRomanNumerals(target, answer);
}

function dispatchChord(target: Chord, answer: MusicAnswerTarget): ChordComparison {
  if (!(answer instanceof Chord)) {
    throw new TypeError(
      `compareMusicAnswer: target is a Chord but answer is not: ${describeValue(answer)}.`,
    );
  }
  return compareChords(target, answer);
}

function dispatchNote(target: Note, answer: MusicAnswerTarget): NoteComparison {
  if (!(answer instanceof Note)) {
    throw new TypeError(
      `compareMusicAnswer: target is a Note but answer is not: ${describeValue(answer)}.`,
    );
  }
  return compareNotes(target, answer);
}

function dispatchScaleDegree(
  target: ScaleDegreeAnalysis,
  answer: MusicAnswerTarget,
): ScaleDegreeComparison {
  if (!isScaleDegreeAnalysis(answer)) {
    throw new TypeError(
      `compareMusicAnswer: target is a ScaleDegreeAnalysis but answer is not: ${describeValue(answer)}.`,
    );
  }
  return compareAnalyses(target, answer);
}

/**
 * Dispatches a structured comparison over Note, Interval, Chord,
 * ScaleDegreeAnalysis, or RomanNumeral targets.
 *
 * The target and answer must be the same kind. For ScaleDegreeAnalysis
 * targets the analyses are compared directly (no key context is needed;
 * degree/alteration/semitoneFromTonic are already encoded in the analysis).
 *
 * @param target The expected value.
 * @param answer The actual value to compare.
 * @returns A structured {@link AnswerComparison}.
 * @throws {TypeError} When the target is not a recognised music-theory value.
 */
export function compareMusicAnswer(
  target: MusicAnswerTarget,
  answer: MusicAnswerTarget,
): AnswerComparison {
  if (target instanceof RomanNumeral) return dispatchRomanNumeral(target, answer);
  if (target instanceof Chord) return dispatchChord(target, answer);
  if (target instanceof Note) return dispatchNote(target, answer);
  if (isScaleDegreeAnalysis(target)) return dispatchScaleDegree(target, answer);
  if (typeof target === 'string' && typeof answer === 'string') {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return compareIntervals(target as Interval, answer as Interval);
  }
  throw new TypeError(`compareMusicAnswer: unsupported target type: ${describeValue(target)}.`);
}
