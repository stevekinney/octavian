// progression.ts: Progression value object, analysis, common patterns, suggestions,
// and modulation detection. Builds on RomanNumeral, Key, chordFromRomanNumeral,
// romanNumeralFor, and identifyCadenceSequence.
//
// There is no circular import with key.ts because this module imports FROM key.ts;
// key.ts does not import from progression.ts.

import type { Chord } from './chord.js';
import { type CadenceOccurrence, type CadenceType, identifyCadenceSequence } from './cadence.js';
import type { Key } from './key.js';
import { chordFromRomanNumeral, romanNumeralFor } from './key-roman.js';
import { RomanNumeral, type RomanNumeralDegree, type RomanNumeralLike } from './roman-numeral.js';

// ---------------------------------------------------------------------------
// Jazz-suffix normalization
// ---------------------------------------------------------------------------
// The RomanNumeral parser is figured-bass only. Jazz shorthand like 'Imaj7'
// or 'iim7' is normalized to the canonical numeral the library already supports
// before handing off to RomanNumeral.create.

/**
 * Normalizes a lead-sheet string like `'Imaj7'`, `'iim7'`, `'V7'` to the
 * figured-bass form expected by {@link RomanNumeral.parse} (`'I7'`, `'ii7'`,
 * `'V7'`).  Unrecognized strings are returned unchanged and let the
 * RomanNumeral parser throw its own error.
 *
 * @internal Exported for testing; not part of the public API surface.
 */
export function normalizeJazzSuffix(input: string): string {
  const trimmed = input.trim();
  // Handle applied chords by recursively normalizing each side of the '/'.
  const slashIndex = findAppliedSlash(trimmed);
  if (slashIndex !== -1) {
    const head = trimmed.slice(0, slashIndex);
    const tail = trimmed.slice(slashIndex + 1);
    return `${normalizeJazzSuffix(head)}/${normalizeJazzSuffix(tail)}`;
  }
  return normalizeSingleToken(trimmed);
}

/**
 * Finds the '/' separating an applied-chord notation (V7/V) from a plain
 * inversion figure (6/4, 4/3 etc.). The applied slash comes after the
 * jazz suffix or degree letters; inversion figures are all digits and slashes.
 */
function findAppliedSlash(input: string): number {
  const idx = input.indexOf('/');
  if (idx === -1) {
    return -1;
  }
  // If everything after '/' is digits, it's an inversion figure, not applied.
  const after = input.slice(idx + 1);
  if (/^\d+$/u.test(after)) {
    return -1;
  }
  return idx;
}

const DEGREE_RE = /^(b|#|♭|♯)?(VII|vii|III|iii|VI|vi|IV|iv|II|ii|V|v|I|i)(.*)/u;

// Jazz suffix → figured-bass mapping. Order matters: longer patterns first.
const JAZZ_SUFFIX_MAP: ReadonlyArray<
  readonly [string, (alt: string, deg: string, rem: string) => string]
> = Object.freeze([
  ['maj7', (alt, deg, rem) => `${alt}${deg}7${rem}`],
  ['m7', (alt, deg, rem) => `${alt}${deg.toLowerCase()}7${rem}`],
  ['°7', (alt, deg, rem) => `${alt}${deg.toLowerCase()}°7${rem}`],
  ['dim7', (alt, deg, rem) => `${alt}${deg.toLowerCase()}°7${rem}`],
  ['ø7', (alt, deg, rem) => `${alt}${deg.toLowerCase()}°7${rem}`],
  ['7', (alt, deg, rem) => `${alt}${deg}7${rem}`],
  ['maj', (alt, deg, rem) => `${alt}${deg}${rem}`],
  ['dim', (alt, deg, rem) => `${alt}${deg.toLowerCase()}°${rem}`],
  ['aug', (alt, deg, rem) => `${alt}${deg.toUpperCase()}+${rem}`],
  ['+', (alt, deg, rem) => `${alt}${deg.toUpperCase()}+${rem}`],
  ['m', (alt, deg, rem) => `${alt}${deg.toLowerCase()}${rem}`],
]);

function normalizeSingleToken(token: string): string {
  const match = DEGREE_RE.exec(token);
  if (match === null) {
    return token;
  }

  const alteration = match[1] ?? '';
  const degreeLetters = match[2] ?? '';
  const rest = match[3] ?? '';

  for (const [suffix, build] of JAZZ_SUFFIX_MAP) {
    if (rest.startsWith(suffix)) {
      const remaining = rest.slice(suffix.length);
      return build(alteration, degreeLetters, remaining);
    }
  }

  // No jazz suffix: return with alteration + degree + remaining as-is.
  return `${alteration}${degreeLetters}${rest}`;
}

/**
 * Parses a {@link RomanNumeralLike} (string, RomanNumeral, or snapshot) into
 * a {@link RomanNumeral}, applying jazz-suffix normalization on strings first.
 */
function parseRomanNumeralLike(input: RomanNumeralLike): RomanNumeral {
  if (typeof input === 'string') {
    return RomanNumeral.parse(normalizeJazzSuffix(input));
  }
  return RomanNumeral.create(input);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A resolved progression in a concrete key — the materialized chord sequence.
 */
export type ResolvedProgression = {
  /** The key the progression was resolved in. */
  readonly key: Key;
  /** The concrete chord sequence, one per numeral. */
  readonly chords: readonly Chord[];
  /** The Roman numerals for each chord. */
  readonly numerals: readonly RomanNumeral[];
};

/**
 * The result of analyzing a chord sequence in a key.
 */
export type ProgressionAnalysis = {
  /** The key the progression was analyzed in. */
  readonly key: Key;
  /** The Roman numeral for each chord, or `null` when unrecognized. */
  readonly numerals: readonly (RomanNumeral | null)[];
  /** All cadences found in the sequence. */
  readonly cadences: readonly CadenceOccurrence[];
  /** Named common-practice patterns found in the sequence. */
  readonly patterns: readonly ProgressionPattern[];
};

/**
 * A recognized common-practice harmonic pattern within a progression.
 */
export type ProgressionPattern = {
  /** Human-readable label for the pattern. */
  readonly name: string;
  /** Starting index in the analyzed chord sequence. */
  readonly startIndex: number;
  /** Ending index (inclusive) in the analyzed chord sequence. */
  readonly endIndex: number;
};

/**
 * A suggestion for what chord might follow the current progression.
 */
export type ProgressionContinuation = {
  /** The suggested next Roman numeral. */
  readonly numeral: RomanNumeral;
  /** The concrete chord in the given key. */
  readonly chord: Chord;
  /** Human-readable reason for the suggestion. */
  readonly reason: string;
};

/**
 * A candidate key that a progression may be moving toward.
 */
export type ModulationCandidate = {
  /**
   * The index in the progression at which modulation evidence begins
   * (the applied chord position).
   */
  readonly startIndex: number;
  /**
   * The Roman numeral that acts as evidence (e.g. `V7/V` implies a move
   * to the dominant key).
   */
  readonly evidenceNumeral: RomanNumeral;
  /**
   * The implied new tonal center as a human-readable label (e.g. `'G major'`).
   */
  readonly toKey: string;
  /** How confidently the system believes a modulation is implied. */
  readonly confidence: 'strong' | 'possible';
};

// ---------------------------------------------------------------------------
// Progression value object
// ---------------------------------------------------------------------------

let createProgression: (numerals: readonly RomanNumeral[]) => Progression;

/**
 * An immutable sequence of Roman numerals representing a harmonic progression.
 *
 * Created from an array of {@link RomanNumeralLike} values (strings like
 * `'ii7'`, `'V7'`, `'I'`, existing `RomanNumeral` instances, or serialized
 * snapshots). Jazz shorthand such as `'Imaj7'` and `'iim7'` is accepted and
 * normalized automatically.
 *
 * @example
 * ```ts
 * const iiVI = Progression.create(['ii7', 'V7', 'Imaj7']);
 * const resolved = iiVI.in(Key.create('C', 'major'));
 * // resolved.chords[0].root.note === 'D', .suffix === 'minorSeventh'
 * // resolved.chords[1].root.note === 'G', .suffix === 'dominantSeventh'
 * // resolved.chords[2].root.note === 'C', .suffix === 'majorSeventh'
 * ```
 */
export class Progression {
  readonly #numerals: readonly RomanNumeral[];

  /** @internal Use {@link Progression.create}. */
  protected constructor(numerals: readonly RomanNumeral[]) {
    this.#numerals = Object.freeze([...numerals]);
  }

  static {
    createProgression = (numerals) => new Progression(numerals);
  }

  /**
   * Creates a {@link Progression} from an array of Roman-numeral inputs.
   *
   * Strings are normalized (jazz suffix → figured-bass) before parsing.
   *
   * @throws {TypeError} when any element cannot be parsed as a Roman numeral.
   */
  public static create(numerals: readonly RomanNumeralLike[]): Progression {
    const parsed = numerals.map(parseRomanNumeralLike);
    return createProgression(parsed);
  }

  /**
   * Returns true when `value` is a constructed {@link Progression}.
   */
  public static isProgression(value: unknown): value is Progression {
    return value instanceof Progression;
  }

  /** The Roman numerals in this progression, in order. */
  public get numerals(): readonly RomanNumeral[] {
    return this.#numerals;
  }

  /** The number of chords in this progression. */
  public get length(): number {
    return this.#numerals.length;
  }

  /**
   * Resolves this progression to concrete chords in the given key.
   *
   * @param key The tonal key to materialize the progression in.
   * @returns A {@link ResolvedProgression} with concrete chords and numerals.
   */
  public in(key: Key): ResolvedProgression {
    const chords = this.#numerals.map((numeral) => chordFromRomanNumeral(key, numeral));
    return Object.freeze({
      key,
      chords: Object.freeze(chords),
      numerals: this.#numerals,
    });
  }

  /** Returns the numerals as an array of Unicode strings. */
  public toStrings(): readonly string[] {
    return this.#numerals.map((n) => n.toString());
  }

  public toString(): string {
    return this.#numerals.map((n) => n.toString()).join(' – ');
  }

  public get [Symbol.toStringTag](): string {
    return `Progression(${this.toString()})`;
  }
}

// ---------------------------------------------------------------------------
// Chord duck-typing helper
// ---------------------------------------------------------------------------

/**
 * Returns true when `value` is a {@link Chord} instance (duck-typed by
 * `root`, `suffix`, and `notes` presence). Used to distinguish Chord inputs
 * from {@link RomanNumeralLike} inputs in the analysis API.
 */
function isChordInstance(value: Chord | RomanNumeralLike): value is Chord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'root' in value &&
    'suffix' in value &&
    'notes' in value
  );
}

// ---------------------------------------------------------------------------
// Pattern recognition
// ---------------------------------------------------------------------------

const NAMED_PATTERNS: ReadonlyArray<{
  readonly name: string;
  readonly degrees: readonly RomanNumeralDegree[];
}> = Object.freeze([
  { name: 'ii–V–I', degrees: [2, 5, 1] },
  { name: 'I–vi–IV–V', degrees: [1, 6, 4, 5] },
  { name: 'I–vi–ii–V', degrees: [1, 6, 2, 5] },
  { name: 'IV–V–I', degrees: [4, 5, 1] },
  { name: 'I–IV–V', degrees: [1, 4, 5] },
]);

function findPatterns(numerals: readonly (RomanNumeral | null)[]): readonly ProgressionPattern[] {
  const patterns: ProgressionPattern[] = [];

  for (const { name, degrees } of NAMED_PATTERNS) {
    const len = degrees.length;
    for (let startIndex = 0; startIndex <= numerals.length - len; startIndex += 1) {
      let match = true;
      for (let offset = 0; offset < len; offset += 1) {
        const numeral = numerals[startIndex + offset];
        if (numeral === null || numeral === undefined || numeral.degree !== degrees[offset]) {
          match = false;
          break;
        }
      }
      if (match) {
        patterns.push(
          Object.freeze({
            name,
            startIndex,
            endIndex: startIndex + len - 1,
          }),
        );
      }
    }
  }

  return Object.freeze(patterns);
}

// ---------------------------------------------------------------------------
// analyzeProgression
// ---------------------------------------------------------------------------

/**
 * Analyzes a sequence of chords (or Roman numerals) in the given key.
 *
 * Each chord is mapped to a {@link RomanNumeral} via {@link romanNumeralFor};
 * unrecognized chords yield `null`. Cadences are found via
 * {@link identifyCadenceSequence} and common harmonic patterns are annotated.
 *
 * @param key The tonal key providing context.
 * @param chords The chord sequence to analyze (Chord instances or numerals).
 * @returns A {@link ProgressionAnalysis}.
 */
export function analyzeProgression(
  key: Key,
  chords: readonly (Chord | RomanNumeralLike)[],
): ProgressionAnalysis {
  // Normalize all inputs to Chord instances.
  const concreteChords: Chord[] = chords.map((item) => {
    if (isChordInstance(item)) {
      return item;
    }
    return chordFromRomanNumeral(key, item);
  });

  const numerals: readonly (RomanNumeral | null)[] = concreteChords.map((chord) =>
    romanNumeralFor(key, chord),
  );

  const cadences = identifyCadenceSequence(key, concreteChords);
  const patterns = findPatterns(numerals);

  return Object.freeze({
    key,
    numerals: Object.freeze(numerals),
    cadences,
    patterns,
  });
}

// ---------------------------------------------------------------------------
// suggestContinuations
// ---------------------------------------------------------------------------

/**
 * Common-practice voice-leading tendency: given the last chord's degree,
 * what degree is likely to follow?  Entries are ordered by preference.
 */
const TENDENCY_TABLE: Readonly<
  Record<RomanNumeralDegree, readonly { degree: RomanNumeralDegree; reason: string }[]>
> = Object.freeze({
  1: Object.freeze([
    { degree: 4 as RomanNumeralDegree, reason: 'Tonic moves to subdominant (I→IV)' },
    { degree: 2 as RomanNumeralDegree, reason: 'Tonic moves to supertonic (I→ii)' },
    { degree: 6 as RomanNumeralDegree, reason: 'Tonic moves to submediant (I→vi)' },
    { degree: 5 as RomanNumeralDegree, reason: 'Tonic moves to dominant (I→V)' },
  ]),
  2: Object.freeze([
    { degree: 5 as RomanNumeralDegree, reason: 'Supertonic resolves to dominant (ii→V)' },
    { degree: 1 as RomanNumeralDegree, reason: 'Supertonic moves to tonic (ii→I)' },
  ]),
  3: Object.freeze([
    { degree: 4 as RomanNumeralDegree, reason: 'Mediant moves to subdominant (iii→IV)' },
    { degree: 6 as RomanNumeralDegree, reason: 'Mediant moves to submediant (iii→vi)' },
  ]),
  4: Object.freeze([
    { degree: 5 as RomanNumeralDegree, reason: 'Subdominant resolves to dominant (IV→V)' },
    { degree: 1 as RomanNumeralDegree, reason: 'Subdominant resolves to tonic (IV→I, plagal)' },
  ]),
  5: Object.freeze([
    { degree: 1 as RomanNumeralDegree, reason: 'Dominant resolves to tonic (V→I, authentic)' },
    { degree: 6 as RomanNumeralDegree, reason: 'Dominant moves to submediant (V→vi, deceptive)' },
  ]),
  6: Object.freeze([
    { degree: 2 as RomanNumeralDegree, reason: 'Submediant moves to supertonic (vi→ii)' },
    { degree: 4 as RomanNumeralDegree, reason: 'Submediant moves to subdominant (vi→IV)' },
    { degree: 5 as RomanNumeralDegree, reason: 'Submediant moves to dominant (vi→V)' },
  ]),
  7: Object.freeze([
    { degree: 1 as RomanNumeralDegree, reason: 'Leading tone resolves to tonic (vii°→I)' },
  ]),
});

/**
 * Suggests likely continuations of a progression based on common-practice
 * voice-leading tendency rules.
 *
 * Suggestions are deterministic: they are derived from a static tendency table
 * keyed by the last chord's scale degree.
 *
 * @param key The tonal key providing context.
 * @param progression The current progression.
 * @param options Optional limit on the number of suggestions returned.
 * @returns An ordered array of {@link ProgressionContinuation} suggestions.
 */
export function suggestContinuations(
  key: Key,
  progression: Progression,
  options?: { readonly maxSuggestions?: number },
): readonly ProgressionContinuation[] {
  const numerals = progression.numerals;
  if (numerals.length === 0) {
    return Object.freeze([]);
  }

  const lastNumeral = numerals[numerals.length - 1];
  if (lastNumeral === undefined) {
    return Object.freeze([]);
  }

  const tendencies = TENDENCY_TABLE[lastNumeral.degree];
  const maxSuggestions = options?.maxSuggestions ?? tendencies.length;
  const limited = tendencies.slice(0, maxSuggestions);

  const diatonicChords = key.diatonicChords();
  const continuations: ProgressionContinuation[] = [];

  for (const { degree, reason } of limited) {
    const diatonicChord = diatonicChords[degree - 1];
    if (diatonicChord === undefined) {
      continue;
    }
    const rn = romanNumeralFor(key, diatonicChord);
    if (rn === null) {
      continue;
    }
    continuations.push(
      Object.freeze({
        numeral: rn,
        chord: diatonicChord,
        reason,
      }),
    );
  }

  return Object.freeze(continuations);
}

// ---------------------------------------------------------------------------
// detectModulations helpers
// ---------------------------------------------------------------------------

/** Derives the implied new-key label from an applied-chord target. */
function modulationTargetKey(key: Key, target: RomanNumeral): string {
  const targetNote = key.scale.degree(target.degree);
  const newMode = target.quality === 'major' || target.quality === 'augmented' ? 'major' : 'minor';
  return `${targetNote.note} ${newMode}`;
}

/** Returns the confidence level for an applied chord at `index`. */
function modulationConfidence(
  numerals: readonly RomanNumeral[],
  index: number,
  targetDegree: RomanNumeralDegree,
): 'strong' | 'possible' {
  const nextRn = numerals[index + 1];
  if (nextRn !== undefined && nextRn.degree === targetDegree && !nextRn.isApplied) {
    return 'strong';
  }
  return 'possible';
}

/**
 * Scans a progression for secondary-dominant (and secondary leading-tone)
 * patterns that imply a tonicization or modulation.
 *
 * A secondary dominant V7/x strongly implies that `x` may become a new tonic.
 * When the secondary dominant is immediately followed by its resolution chord
 * (the chord on the applied-to degree), the confidence is `'strong'`; a lone
 * applied chord without resolution is `'possible'`.
 *
 * @param key The home key against which the progression is analyzed.
 * @param progression The progression to scan.
 * @param options Optional filter; set `minConfidence: 'strong'` to suppress
 *   `'possible'` candidates.
 * @returns An ordered array of {@link ModulationCandidate} detections.
 */
export function detectModulations(
  key: Key,
  progression: Progression,
  options?: { readonly minConfidence?: 'strong' | 'possible' },
): readonly ModulationCandidate[] {
  const numerals = progression.numerals;
  const minConfidence = options?.minConfidence ?? 'possible';
  const candidates: ModulationCandidate[] = [];

  for (let index = 0; index < numerals.length; index += 1) {
    const rn = numerals[index];
    if (rn === undefined || !rn.isApplied) {
      continue;
    }
    const appliedTarget = rn.applied;
    if (appliedTarget === undefined) {
      continue;
    }
    const confidence = modulationConfidence(numerals, index, appliedTarget.degree);
    if (minConfidence === 'strong' && confidence !== 'strong') {
      continue;
    }
    candidates.push(
      Object.freeze({
        startIndex: index,
        evidenceNumeral: rn,
        toKey: modulationTargetKey(key, appliedTarget),
        confidence,
      }),
    );
  }

  return Object.freeze(candidates);
}

// Re-export cadence types so consumers can import from a single module.
export type { CadenceType, CadenceOccurrence };
