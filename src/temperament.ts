/**
 * Temperament and tuning-system support for Octavian.
 *
 * This module is SEPARATE from the existing A4-reference {@link Tuning} in
 * `src/tuning.ts`.  Tuning (a reference frequency for A4) controls the
 * overall pitch standard.  Temperament controls the *shape* of the octave —
 * how intervals are divided.
 *
 * Four kinds are supported as a discriminated union:
 *
 * - `EqualTemperament` — 12-TET (the default).  All operations delegate to
 *   the existing {@link midiToFrequency} to guarantee bit-exact agreement.
 * - `JustIntonation` — 5-limit rational ratios relative to a tonic.
 * - `CentsOffsetTemperament` — per-pitch-class offsets (in cents) from 12-TET.
 * - `EDO` — equal divisions of the octave (e.g. 19, 24, 31).
 *
 * ## Design conventions
 * - `frequencyFor` requires `keyOrTonic` when the temperament is
 *   `JustIntonation`; it throws `TypeError` when omitted.
 * - For EDO systems, each MIDI step is treated as one EDO step offset from
 *   MIDI 69 (A4), so `EDO(12)` reproduces 12-TET exactly.
 * - All public helpers accept plain `number` at boundaries; branded types
 *   are applied internally.
 */

import { createFrequency, type Frequency, type MidiKey } from './branded-types.js';
import { midiToFrequency } from './music-utilities.js';
import { Note, type NoteLike } from './note.js';
import { STANDARD_TUNING, type Tuning } from './tuning.js';
import { justRatioForSemitone, ratioValue } from './just-intonation.js';

// ---------------------------------------------------------------------------
// Temperament discriminated union
// ---------------------------------------------------------------------------

/**
 * 12-tone equal temperament — the standard Western tuning system where each
 * semitone is exactly 100 cents.
 */
export type EqualTemperament = {
  readonly kind: 'equal';
};

/**
 * 5-limit just intonation — intervals derived from small-integer ratios
 * relative to a tonic note.  Requires a tonic when computing frequencies.
 */
export type JustIntonation = {
  readonly kind: 'just';
};

/**
 * Per-pitch-class cent offsets from 12-TET.  The `offsets` array must have
 * exactly 12 entries indexed by chromatic pitch class (0 = C, 1 = C♯, …,
 * 11 = B).  Positive values sharpen, negative values flatten.
 */
export type CentsOffsetTemperament = {
  readonly kind: 'cents-offset';
  readonly offsets: readonly number[];
};

/**
 * Equal division of the octave into `n` steps.  `EDO(12)` reproduces 12-TET
 * exactly.  Each step is `1200 / n` cents.
 */
export type EDO = {
  readonly kind: 'edo';
  readonly divisions: number;
};

/**
 * A discriminated union of all supported temperament kinds.
 */
export type Temperament = EqualTemperament | JustIntonation | CentsOffsetTemperament | EDO;

// ---------------------------------------------------------------------------
// Catalog constants
// ---------------------------------------------------------------------------

/**
 * The default 12-tone equal temperament.
 */
export const EQUAL_TEMPERAMENT: EqualTemperament = Object.freeze({
  kind: 'equal',
} satisfies EqualTemperament);

/**
 * 5-limit just intonation.  Use with a `keyOrTonic` when calling
 * {@link frequencyFor}; the tonic determines which ratio applies to each
 * note.
 */
export const JUST_INTONATION: JustIntonation = Object.freeze({
  kind: 'just',
} satisfies JustIntonation);

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/**
 * Creates an equal-division-of-the-octave temperament with `n` divisions.
 *
 * `EDO(12)` is equivalent to {@link EQUAL_TEMPERAMENT}.
 * `EDO(24)` is the standard quarter-tone system (50 cents per step).
 *
 * @param divisions The number of equal divisions per octave. Must be a
 *   positive integer ≥ 1.
 * @returns The EDO temperament.
 * @throws {RangeError} When `divisions` is not a positive integer.
 */
export function edo(divisions: number): EDO {
  if (!Number.isInteger(divisions) || divisions < 1) {
    throw new RangeError(
      `Expected a positive integer number of EDO divisions, received ${divisions}.`,
    );
  }

  return Object.freeze({ kind: 'edo', divisions } satisfies EDO);
}

/**
 * Creates a cents-offset temperament from an array of 12 per-pitch-class
 * offsets.  Entry `i` (0 = C, 1 = C♯/D♭, …, 11 = B) is added to the
 * equal-tempered frequency for that pitch class.
 *
 * @param offsets An array of exactly 12 finite cent offsets.
 * @returns The cents-offset temperament.
 * @throws {TypeError} When `offsets` does not have exactly 12 entries.
 * @throws {RangeError} When any offset is not a finite number.
 */
export function centsOffsetTemperament(offsets: readonly number[]): CentsOffsetTemperament {
  if (offsets.length !== 12) {
    throw new TypeError(
      `Expected exactly 12 cent offsets (one per pitch class), received ${offsets.length}.`,
    );
  }

  for (let i = 0; i < offsets.length; i += 1) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const offset = offsets[i]!;

    if (!Number.isFinite(offset)) {
      throw new RangeError(`Expected a finite cent offset at index ${i}, received ${offset}.`);
    }
  }

  return Object.freeze({
    kind: 'cents-offset',
    offsets: Object.freeze([...offsets]),
  } satisfies CentsOffsetTemperament);
}

// ---------------------------------------------------------------------------
// A tuned pitch — the output of tunedScale
// ---------------------------------------------------------------------------

/**
 * A single scale degree with its just-tuned or temperament-adjusted frequency.
 */
export type TunedPitch = {
  /** The note (spelling, MIDI, ET frequency). */
  readonly note: Note;
  /** The temperament-adjusted frequency for this pitch. */
  readonly frequency: Frequency;
  /** Cents deviation from the equal-tempered frequency for this MIDI key. */
  readonly centsDeviation: number;
};

// ---------------------------------------------------------------------------
// frequencyFor options
// ---------------------------------------------------------------------------

/**
 * Options for {@link frequencyFor}.
 */
export type FrequencyForOptions = {
  /**
   * The A4 reference tuning to use. Defaults to {@link STANDARD_TUNING}
   * (440 Hz).
   */
  readonly referenceTuning?: Tuning;
  /**
   * The temperament to use. Defaults to {@link EQUAL_TEMPERAMENT}.
   */
  readonly temperament?: Temperament;
  /**
   * The tonic note used to compute just intonation ratios.  Required when
   * `temperament.kind === 'just'`; ignored for all other temperament kinds.
   */
  readonly keyOrTonic?: NoteLike;
};

// ---------------------------------------------------------------------------
// centsBetween
// ---------------------------------------------------------------------------

/**
 * Returns the signed cent distance between two frequencies.
 *
 * Result is positive when `frequencyB` is higher than `frequencyA`.
 * `centsBetween(440, 880) === 1200` (one octave).
 * `centsBetween(f, f) === 0`.
 *
 * @param frequencyA The reference frequency in hertz. Must be positive and finite.
 * @param frequencyB The target frequency in hertz. Must be positive and finite.
 * @returns Signed cents: `1200 * log2(frequencyB / frequencyA)`.
 * @throws {RangeError} When either frequency is not positive and finite.
 */
export function centsBetween(frequencyA: number, frequencyB: number): number {
  // validate: throws RangeError for non-positive / non-finite input
  createFrequency(frequencyA);
  createFrequency(frequencyB);

  return 1200 * Math.log2(frequencyB / frequencyA);
}

// ---------------------------------------------------------------------------
// Internal per-kind frequency helpers
// ---------------------------------------------------------------------------

function frequencyForEqual(midi: MidiKey, tuning: Tuning): Frequency {
  // Delegate to midiToFrequency to guarantee bit-exact equality with the
  // existing Note.frequency / midiToFrequency behavior.
  return midiToFrequency(midi, tuning);
}

function frequencyForEdo(midi: MidiKey, tuning: Tuning, divisions: number): Frequency {
  // Mirror midiToFrequency's exact floating-point expression but with
  // `divisions` in place of 12.  At divisions === 12 the expression is
  // identical, so EDO(12) is bit-exact 12-TET.
  const numericFrequency = Number(tuning.frequency) * 2 ** ((Number(midi) - 69) / divisions);

  return createFrequency(numericFrequency);
}

function frequencyForCentsOffset(
  midi: MidiKey,
  tuning: Tuning,
  offsets: readonly number[],
): Frequency {
  const etFrequency = Number(midiToFrequency(midi, tuning));
  const pitchClass = Number(midi) % 12;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const offsetCents = offsets[pitchClass]!;
  // Convert cent offset to a frequency multiplier: 2^(cents / 1200)
  const adjusted = etFrequency * 2 ** (offsetCents / 1200);

  return createFrequency(adjusted);
}

function frequencyForJust(midi: MidiKey, tuning: Tuning, tonicNote: Note): Frequency {
  const tonicMidi = Number(tonicNote.midi);
  const noteMidi = Number(midi);

  // Semitones from tonic, reduced into [0, 12)
  const rawSemitones = noteMidi - tonicMidi;
  const octavesAboveTonic = Math.floor(rawSemitones / 12);
  const semitoneInOctave = ((rawSemitones % 12) + 12) % 12;

  // Compute the tonic frequency under equal temperament (the reference
  // anchor; JI ratios are then applied on top).
  const tonicFreq = Number(midiToFrequency(tonicNote.midi, tuning));

  // Ratio for this scale degree from the 5-limit major catalog
  const ratio = justRatioForSemitone(semitoneInOctave);
  const adjusted = tonicFreq * ratioValue(ratio) * 2 ** octavesAboveTonic;

  return createFrequency(adjusted);
}

// ---------------------------------------------------------------------------
// frequencyFor
// ---------------------------------------------------------------------------

/**
 * Returns the frequency of a note under the specified temperament and A4
 * reference tuning.
 *
 * The default (equal temperament + standard tuning) is bit-exact with
 * `midiToFrequency` and `Note.frequency`.
 *
 * @param note Any note-like value.
 * @param options Options controlling the tuning reference and temperament.
 * @returns The frequency in hertz under the given temperament.
 * @throws {TypeError} When `temperament` is `'just'` and `keyOrTonic` is
 *   not provided, or when the note's semitone offset from the tonic is not
 *   a major-scale degree.
 * @throws {RangeError} When the computed frequency is not a positive finite
 *   number.
 */
export function frequencyFor(note: NoteLike, options: FrequencyForOptions = {}): Frequency {
  const {
    referenceTuning = STANDARD_TUNING,
    temperament = EQUAL_TEMPERAMENT,
    keyOrTonic,
  } = options;

  const resolvedNote = Note.create(note);

  switch (temperament.kind) {
    case 'equal':
      return frequencyForEqual(resolvedNote.midi, referenceTuning);

    case 'edo':
      return frequencyForEdo(resolvedNote.midi, referenceTuning, temperament.divisions);

    case 'cents-offset':
      return frequencyForCentsOffset(resolvedNote.midi, referenceTuning, temperament.offsets);

    case 'just': {
      if (keyOrTonic === undefined) {
        throw new TypeError(
          'A keyOrTonic must be provided when using just intonation temperament.',
        );
      }

      const tonicNote = Note.create(keyOrTonic);

      return frequencyForJust(resolvedNote.midi, referenceTuning, tonicNote);
    }
  }
}

// ---------------------------------------------------------------------------
// tunedScale
// ---------------------------------------------------------------------------

/**
 * Options for {@link tunedScale}.
 */
export type TunedScaleOptions = {
  /**
   * The A4 reference tuning to use. Defaults to {@link STANDARD_TUNING}.
   */
  readonly referenceTuning?: Tuning;
  /**
   * The tonic note used to compute just intonation ratios when
   * `temperament.kind === 'just'`. If omitted, the first note in `notes`
   * is used as the tonic (best-effort default).
   */
  readonly keyOrTonic?: NoteLike;
};

/**
 * Returns every scale degree with its temperament-adjusted frequency and
 * cent deviation from equal temperament.
 *
 * When `temperament` is `'just'`, each note's frequency is derived from
 * 5-limit ratios relative to the tonic. If `options.keyOrTonic` is omitted,
 * the first note is used as the tonic.
 *
 * @param notes The notes to tune (typically from a {@link Scale}).
 * @param temperament The temperament to apply.
 * @param options Additional options (reference tuning, tonic).
 * @returns An ordered array of tuned pitches.
 * @throws {TypeError} When `temperament` is `'just'` and any note in `notes`
 *   is not a major-scale degree relative to the tonic (`options.keyOrTonic`
 *   when provided, otherwise the first note).
 */
export function tunedScale(
  notes: readonly NoteLike[],
  temperament: Temperament,
  options: TunedScaleOptions = {},
): readonly TunedPitch[] {
  const { referenceTuning = STANDARD_TUNING, keyOrTonic } = options;

  if (notes.length === 0) {
    return Object.freeze([]);
  }

  // For just intonation use the caller-supplied tonic when provided; fall
  // back to the first note as a documented best-effort default.
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const tonicNoteLike = keyOrTonic ?? notes[0]!;

  return Object.freeze(
    notes.map((noteLike) => {
      const note = Note.create(noteLike);
      const frequencyOptions: FrequencyForOptions =
        temperament.kind === 'just'
          ? { referenceTuning, temperament, keyOrTonic: tonicNoteLike }
          : { referenceTuning, temperament };
      const frequency = frequencyFor(note, frequencyOptions);
      const etFrequency = Number(midiToFrequency(note.midi, referenceTuning));
      const centsDeviation = centsBetween(etFrequency, Number(frequency));

      return Object.freeze({ note, frequency, centsDeviation } satisfies TunedPitch);
    }),
  );
}
