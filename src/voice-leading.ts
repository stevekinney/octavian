import type { CanonicalInterval } from './intervals.js';
import { resolveInterval } from './intervals.js';
import { Key } from './key.js';
import type { MelodicDirection } from './melody.js';
import { Note, type NoteLike } from './note.js';
import { NATURALS, naturalFromNoteName } from './note-spellings.js';
import { degreeForNote } from './scale-degree.js';
import type { Chord, ChordVoicing } from './chord.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The relative motion between two voice pairs.
 *
 * - `'parallel'` — both voices move in the same direction, maintaining the
 *   same **generic** interval (e.g., two voices both moving up by a step
 *   while staying a third apart).
 * - `'similar'` — both voices move in the same direction but the generic
 *   interval changes (e.g., both up, a third becoming a fifth).
 * - `'contrary'` — one voice moves up and the other down.
 * - `'oblique'` — one voice stays on the same pitch while the other moves.
 */
export type VoiceMotion = 'parallel' | 'similar' | 'contrary' | 'oblique';

/**
 * A per-voice summary produced by {@link analyzeVoiceLeading}.
 */
export type VoiceLeadingStep = {
  /** Zero-based voice index (0 = bass / lowest note in the voicing). */
  readonly voiceIndex: number;
  /** The starting note. */
  readonly from: Note;
  /** The ending note. */
  readonly to: Note;
  /**
   * The signed semitone distance from `from` to `to`.
   * Positive = ascending, negative = descending, 0 = stationary.
   */
  readonly semitones: number;
  /** Ascending/descending/stationary direction. */
  readonly direction: MelodicDirection;
  /**
   * The spelled melodic interval (ascending) from `from` to `to`, or `null`
   * when the two notes are enharmonically identical (unison at the same MIDI).
   */
  readonly interval: CanonicalInterval | null;
};

/**
 * The aggregate result of comparing two voicings via {@link analyzeVoiceLeading}.
 *
 * **Voice ordering**: voices are paired by array index. The `from` and `to`
 * arrays must have the same length. When supplying `ChordVoicing` values,
 * `ChordVoicing.notes` is already sorted ascending (bass = index 0). When
 * supplying raw `Note[]` arrays the caller's ordering is preserved as-is —
 * do NOT rely on ascending-sort to establish voice identity.
 */
export type VoiceLeadingAnalysis = {
  /** Per-voice step information, indexed in the same order as the input arrays. */
  readonly steps: readonly VoiceLeadingStep[];
  /** Voice-motion classification for every adjacent voice pair (0–1, 1–2, …). */
  readonly motions: readonly {
    readonly lowerVoiceIndex: number;
    readonly upperVoiceIndex: number;
    readonly motion: VoiceMotion;
  }[];
};

/**
 * A voice-leading issue detected by {@link findParallelPerfects}.
 */
export type VoiceLeadingIssue = {
  /** The voice-leading issue type. */
  readonly type: 'parallel-fifth' | 'parallel-octave';
  /** Index of the lower voice in the voicing (0 = bass). */
  readonly lowerVoiceIndex: number;
  /** Index of the upper voice. */
  readonly upperVoiceIndex: number;
  /** The starting note of the lower voice. */
  readonly lowerFrom: Note;
  /** The starting note of the upper voice. */
  readonly upperFrom: Note;
  /** The ending note of the lower voice. */
  readonly lowerTo: Note;
  /** The ending note of the upper voice. */
  readonly upperTo: Note;
};

/**
 * The result of checking a single voice's tendency-tone resolution.
 */
export type ResolutionCheck = {
  /**
   * The resolution kind:
   * - `'leading-tone'` — the voice was on the leading tone (scale degree 7,
   *   one semitone below the tonic) and should resolve up by a half step.
   * - `'chordal-seventh'` — the voice was the chordal seventh of the previous
   *   chord and should resolve down by a step.
   */
  readonly type: 'leading-tone' | 'chordal-seventh';
  /** Zero-based voice index (0 = bass). */
  readonly voiceIndex: number;
  /** The tendency tone (the voice's starting note). */
  readonly from: Note;
  /** The voice's ending note. */
  readonly to: Note;
  /**
   * `true` when the resolution is correct per common-practice rules:
   * - Leading tone → resolves up a half step (to the tonic).
   * - Chordal seventh → resolves down by a step (minor or major second).
   */
  readonly resolved: boolean;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts a normalized `readonly Note[]` from any of the three accepted
 * voicing input shapes.
 */
function notesOf(value: Chord | ChordVoicing | readonly Note[]): readonly Note[] {
  if (Array.isArray(value)) {
    // value is `readonly Note[]` after the Array.isArray guard.
    // The cast keeps TS happy since Array.isArray infers `unknown[]`.
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return value as readonly Note[];
  }
  // After the array guard, value is `Chord | ChordVoicing` — both expose
  // `.notes: readonly Note[]` so the access is type-safe.
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return (value as Chord).notes;
}

/**
 * Returns the zero-based staff position (0 = C, 1 = D, … 6 = B) for a note
 * letter, extended across octaves: `staffStep(note) = octave * 7 + letterIndex`.
 *
 * This produces a monotonically increasing integer representing absolute
 * staff position, so the difference between two positions gives the generic
 * interval size (a unison = 0 difference, a third = ±2 difference, etc.).
 */
function staffStep(note: Note): number {
  const letterIndex = NATURALS.indexOf(naturalFromNoteName(note.note));
  return note.octave * 7 + letterIndex;
}

/**
 * Returns the generic interval size (positive integer, unison = 1) between
 * two notes based purely on staff letter + octave position. This never
 * throws, works for compound intervals, and is independent of chromatic
 * alteration — matching the counterpoint-theory definition of "same generic
 * interval" for parallel motion.
 */
function genericIntervalSize(lower: Note, upper: Note): number {
  return Math.abs(staffStep(upper) - staffStep(lower)) + 1;
}

/**
 * Returns the melodic direction for a signed semitone distance.
 */
function directionFor(semitones: number): MelodicDirection {
  if (semitones > 0) return 'up';
  if (semitones < 0) return 'down';
  return 'same';
}

// ---------------------------------------------------------------------------
// analyzeVoiceLeading
// ---------------------------------------------------------------------------

/**
 * Analyzes the voice-leading motion between two voicings.
 *
 * Voices are paired by **array index** (index 0 = bass / lowest voice when
 * using `ChordVoicing`; caller-defined order for raw `Note[]` inputs).
 * Both `from` and `to` must have the same number of voices.
 *
 * The `steps` array contains per-voice melodic information (direction,
 * semitone distance, and the ascending spelled interval). The `motions`
 * array classifies the relative motion between every adjacent voice pair.
 *
 * @param fromVoicing The starting voicing (Chord, ChordVoicing, or Note[]).
 * @param toVoicing The ending voicing (Chord, ChordVoicing, or Note[]).
 * @returns The voice-leading analysis.
 * @throws {RangeError} When the two voicings have different voice counts.
 */
export function analyzeVoiceLeading(
  fromVoicing: Chord | ChordVoicing | readonly Note[],
  toVoicing: Chord | ChordVoicing | readonly Note[],
): VoiceLeadingAnalysis {
  const fromNotes = notesOf(fromVoicing);
  const toNotes = notesOf(toVoicing);

  if (fromNotes.length !== toNotes.length) {
    throw new RangeError(
      `analyzeVoiceLeading: from voicing has ${fromNotes.length} voices but to voicing has ${toNotes.length} voices.`,
    );
  }

  const steps: VoiceLeadingStep[] = fromNotes.map((from, index) => {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const to = toNotes[index]!;
    const semitones = Number(to.midi) - Number(from.midi);
    const direction = directionFor(semitones);

    let interval: CanonicalInterval | null = null;
    if (semitones !== 0) {
      // Always measure low→high so the interval name reflects the unsigned size.
      const [lo, hi] = Number(from.midi) <= Number(to.midi) ? [from, to] : [to, from];
      // resolveInterval narrows Interval → CanonicalInterval.
      interval = resolveInterval(lo.distanceTo(hi));
    }

    return { voiceIndex: index, from, to, semitones, direction, interval };
  });

  const motions = [];
  for (let i = 0; i < steps.length - 1; i += 1) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const lower = steps[i]!;
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const upper = steps[i + 1]!;
    motions.push({
      lowerVoiceIndex: lower.voiceIndex,
      upperVoiceIndex: upper.voiceIndex,
      motion: voiceMotion([lower.from, lower.to], [upper.from, upper.to]),
    });
  }

  return { steps: Object.freeze(steps), motions: Object.freeze(motions) };
}

// ---------------------------------------------------------------------------
// voiceMotion
// ---------------------------------------------------------------------------

/**
 * Classifies the relative motion between two voices given their start and end
 * notes.
 *
 * Motion classification (Aldwell & Schachter, common-practice counterpoint):
 * - **parallel** — both voices move in the same direction while maintaining
 *   the same **generic** interval (letter + octave, quality ignored).
 * - **similar** — both voices move in the same direction but the generic
 *   interval changes.
 * - **contrary** — one voice moves up and the other moves down.
 * - **oblique** — one voice is stationary (same MIDI pitch) while the other
 *   moves. When both voices are stationary the result is `'oblique'`.
 *
 * @param lowerVoicePair A `[from, to]` pair for the lower voice.
 * @param upperVoicePair A `[from, to]` pair for the upper voice.
 * @returns The motion classification.
 */
export function voiceMotion(
  lowerVoicePair: readonly [Note | NoteLike, Note | NoteLike],
  upperVoicePair: readonly [Note | NoteLike, Note | NoteLike],
): VoiceMotion {
  const lowerFrom = Note.create(lowerVoicePair[0]);
  const lowerTo = Note.create(lowerVoicePair[1]);
  const upperFrom = Note.create(upperVoicePair[0]);
  const upperTo = Note.create(upperVoicePair[1]);

  const lowerDelta = Number(lowerTo.midi) - Number(lowerFrom.midi);
  const upperDelta = Number(upperTo.midi) - Number(upperFrom.midi);

  // Oblique: at least one voice is stationary (including both-static).
  if (lowerDelta === 0 || upperDelta === 0) {
    return 'oblique';
  }

  // Contrary: opposite directions.
  if ((lowerDelta > 0 && upperDelta < 0) || (lowerDelta < 0 && upperDelta > 0)) {
    return 'contrary';
  }

  // Both voices moving in the same direction — parallel or similar based on
  // whether the *generic* interval (letter-based) is maintained.
  const startGeneric = genericIntervalSize(lowerFrom, upperFrom);
  const endGeneric = genericIntervalSize(lowerTo, upperTo);

  return startGeneric === endGeneric ? 'parallel' : 'similar';
}

// ---------------------------------------------------------------------------
// commonTones
// ---------------------------------------------------------------------------

/**
 * Returns the notes held in common between two chords or voicings, compared
 * by **pitch class** (chromatic index, mod 12).
 *
 * The returned notes are taken from `fromChordOrVoicing`. Enharmonic spellings
 * that share the same pitch class count as common tones — e.g., C♯ and D♭
 * are the same pitch class and would be treated as common. The return set is
 * deduplicated so each pitch class appears at most once.
 *
 * @param fromChordOrVoicing The starting chord, voicing, or note array.
 * @param toChordOrVoicing The ending chord, voicing, or note array.
 * @returns Notes from the `from` voicing whose pitch class also appears in `to`.
 */
export function commonTones(
  fromChordOrVoicing: Chord | ChordVoicing | readonly Note[],
  toChordOrVoicing: Chord | ChordVoicing | readonly Note[],
): readonly Note[] {
  const fromNotes = notesOf(fromChordOrVoicing);
  const toNotes = notesOf(toChordOrVoicing);

  const toPitchClasses = new Set(toNotes.map((n) => n.chromaticIndex));

  // Deduplicate by pitch class — first occurrence wins.
  const seen = new Set<number>();
  const result: Note[] = [];
  for (const note of fromNotes) {
    if (toPitchClasses.has(note.chromaticIndex) && !seen.has(note.chromaticIndex)) {
      seen.add(note.chromaticIndex);
      result.push(note);
    }
  }

  return Object.freeze(result);
}

// ---------------------------------------------------------------------------
// findParallelPerfects
// ---------------------------------------------------------------------------

/**
 * Detects parallel fifths and parallel octaves between all pairs of voices
 * across a voice-leading motion.
 *
 * **Definition** (common-practice counterpoint): a parallel perfect occurs
 * when two voices that are a perfect fifth (7 semitones mod 12) or perfect
 * octave (12 semitones) apart both move by the **exact same signed semitone
 * distance** (same direction AND same distance). The pitch gap is preserved
 * exactly because the deltas are equal.
 *
 * This pitch-based (semitone) detection is intentionally spelling-agnostic:
 * `P5 → P5` is parallel regardless of enharmonic respelling.
 *
 * **Not flagged:**
 * - Contrary or oblique motion into a fifth/octave.
 * - A perfect fifth held via a common tone (one delta = 0).
 * - Similar motion that happens to land on a fifth/octave with unequal deltas.
 * - Parallel unisons (`gap % 12 === 0 && gap === 0`) — out of scope; see
 *   roadmap item 2.13 for `detectVoiceCrossing`.
 *
 * Voice pairs are enumerated in lower-voice-first order (0–1, 0–2, 1–2, …).
 *
 * @param fromVoicing The starting voicing.
 * @param toVoicing The ending voicing.
 * @returns All detected parallel fifth and octave issues.
 * @throws {RangeError} When the voicings have different voice counts.
 */
export function findParallelPerfects(
  fromVoicing: Chord | ChordVoicing | readonly Note[],
  toVoicing: Chord | ChordVoicing | readonly Note[],
): readonly VoiceLeadingIssue[] {
  const fromNotes = notesOf(fromVoicing);
  const toNotes = notesOf(toVoicing);

  if (fromNotes.length !== toNotes.length) {
    throw new RangeError(
      `findParallelPerfects: from voicing has ${fromNotes.length} voices but to voicing has ${toNotes.length} voices.`,
    );
  }

  const issues: VoiceLeadingIssue[] = [];

  for (let i = 0; i < fromNotes.length - 1; i += 1) {
    for (let j = i + 1; j < fromNotes.length; j += 1) {
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      const lowerFrom = fromNotes[i]!;
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      const upperFrom = fromNotes[j]!;
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      const lowerTo = toNotes[i]!;
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      const upperTo = toNotes[j]!;

      const issue = detectParallelBetweenPair(i, j, lowerFrom, upperFrom, lowerTo, upperTo);
      if (issue !== null) {
        issues.push(issue);
      }
    }
  }

  return Object.freeze(issues);
}

/**
 * Checks a single pair of voices for a parallel fifth or octave.
 * Returns a {@link VoiceLeadingIssue} or `null` when none is found.
 */
function detectParallelBetweenPair(
  lowerIndex: number,
  upperIndex: number,
  lowerFrom: Note,
  upperFrom: Note,
  lowerTo: Note,
  upperTo: Note,
): VoiceLeadingIssue | null {
  const lowerDelta = Number(lowerTo.midi) - Number(lowerFrom.midi);
  const upperDelta = Number(upperTo.midi) - Number(upperFrom.midi);

  // Parallel requires same nonzero signed delta (same direction AND distance).
  // If deltas differ, any motion is not a strict parallel (similar, contrary,
  // or oblique). If both deltas are 0 both voices are static — no motion.
  if (lowerDelta !== upperDelta || lowerDelta === 0) {
    return null;
  }

  // The harmonic gap is preserved exactly (delta is equal), so measure only
  // the starting gap.
  const gap = Math.abs(Number(upperFrom.midi) - Number(lowerFrom.midi));
  const gapMod = gap % 12;

  if (gapMod === 7) {
    return {
      type: 'parallel-fifth',
      lowerVoiceIndex: lowerIndex,
      upperVoiceIndex: upperIndex,
      lowerFrom,
      upperFrom,
      lowerTo,
      upperTo,
    };
  }

  // Parallel octave: gap is a nonzero multiple of 12. Gap === 0 would be a
  // unison — excluded per scope (see JSDoc).
  if (gapMod === 0 && gap !== 0) {
    return {
      type: 'parallel-octave',
      lowerVoiceIndex: lowerIndex,
      upperVoiceIndex: upperIndex,
      lowerFrom,
      upperFrom,
      lowerTo,
      upperTo,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// leadingToneResolutions
// ---------------------------------------------------------------------------

/**
 * Checks tendency-tone resolution for each voice across a voice-leading
 * motion in the given key.
 *
 * Two tendency tones are checked:
 * - **Leading tone** (scale degree 7, one semitone below the tonic):
 *   should resolve **up a half step** to the tonic. This correctly identifies
 *   both the diatonic leading tone in major keys and the raised 7th in minor
 *   (if present in the voicing), since detection is by semitone distance from
 *   the tonic (semitoneFromTonic === 11), not by scale degree.
 * - **Chordal seventh**: the chordal 7th of the `fromVoicing` chord (requires
 *   `ChordVoicing` input so the chord identity is available); should resolve
 *   **down by a minor or major second** (1–2 semitones).
 *
 * When a `fromVoicing` is a raw `Note[]` or `Chord`, only leading-tone checks
 * are performed (no chord identity for the chordal-seventh rule).
 *
 * @param key The tonal key context.
 * @param fromVoicing The starting voicing.
 * @param toVoicing The ending voicing.
 * @returns All resolution checks for tendency tones found in `fromVoicing`.
 * @throws {RangeError} When the voicings have different voice counts.
 */
export function leadingToneResolutions(
  key: Key,
  fromVoicing: Chord | ChordVoicing | readonly Note[],
  toVoicing: Chord | ChordVoicing | readonly Note[],
): readonly ResolutionCheck[] {
  const fromNotes = notesOf(fromVoicing);
  const toNotes = notesOf(toVoicing);

  if (fromNotes.length !== toNotes.length) {
    throw new RangeError(
      `leadingToneResolutions: from voicing has ${fromNotes.length} voices but to voicing has ${toNotes.length} voices.`,
    );
  }

  const checks: ResolutionCheck[] = [];

  // Leading tone checks — applicable for any voicing shape.
  addLeadingToneChecks(key, fromNotes, toNotes, checks);

  // Chordal seventh checks — only when fromVoicing is a ChordVoicing.
  if (isChordVoicing(fromVoicing)) {
    addChordalSeventhChecks(fromVoicing, toNotes, checks);
  }

  return Object.freeze(checks);
}

/**
 * Returns `true` when `value` is a `ChordVoicing` (has a `.chord` property
 * that is a `Chord`-like instance — distinguished from a raw `Chord` by the
 * presence of `voicing.chord`).
 */
function isChordVoicing(value: Chord | ChordVoicing | readonly Note[]): value is ChordVoicing {
  return (
    !Array.isArray(value) &&
    typeof value === 'object' &&
    value !== null &&
    'chord' in value &&
    'notes' in value &&
    'bass' in value
  );
}

/**
 * Appends leading-tone resolution checks to `checks`.
 */
function addLeadingToneChecks(
  key: Key,
  fromNotes: readonly Note[],
  toNotes: readonly Note[],
  checks: ResolutionCheck[],
): void {
  for (let i = 0; i < fromNotes.length; i += 1) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const from = fromNotes[i]!;
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const to = toNotes[i]!;

    const analysis = degreeForNote(key, from);
    if (analysis === null) continue;

    // Leading tone: semitoneFromTonic === 11 (one semitone below tonic).
    // This correctly identifies both diatonic (major ♮7) and raised minor 7.
    if (analysis.semitoneFromTonic === 11) {
      const semitones = Number(to.midi) - Number(from.midi);
      checks.push({
        type: 'leading-tone',
        voiceIndex: i,
        from,
        to,
        resolved: semitones === 1,
      });
    }
  }
}

/**
 * Appends chordal-seventh resolution checks to `checks`.
 */
function addChordalSeventhChecks(
  fromVoicing: ChordVoicing,
  toNotes: readonly Note[],
  checks: ResolutionCheck[],
): void {
  const chord = fromVoicing.chord;
  // The chordal seventh is the note at the seventh interval of the chord.
  const chordalSeventh = chord.degree(7);
  if (chordalSeventh === null) return;

  const voicingNotes = fromVoicing.notes;
  for (let i = 0; i < voicingNotes.length; i += 1) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const from = voicingNotes[i]!;
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const to = toNotes[i]!;

    if (from.chromaticIndex !== chordalSeventh.chromaticIndex) continue;

    const semitones = Number(to.midi) - Number(from.midi);
    // Resolves correctly when the voice descends by a minor (1) or major (2) second.
    checks.push({
      type: 'chordal-seventh',
      voiceIndex: i,
      from,
      to,
      resolved: semitones === -1 || semitones === -2,
    });
  }
}
