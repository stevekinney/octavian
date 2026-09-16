import { Chord } from './chord.js';
import { chordRequirements, omittedIntervalsFor, type ChordOmissions } from './chord-tones.js';
import { createMidiKey } from './branded-types.js';
import { Note } from './note.js';
import { KEYBOARD_88, pianoKeyFor, type KeyboardRange, type PianoKey } from './piano-keyboard.js';
import type { Interval } from './intervals.js';

export type PianoVoicingHands = 'both' | 'left' | 'right';

/** Configuration controlling piano voicing enumeration. */
export type PianoVoicingOptions = {
  /** Inclusive MIDI range to search. Defaults to {@link KEYBOARD_88}. */
  readonly range?: KeyboardRange;
  /** Maximum number of keys assigned to either hand. Defaults to `5`. */
  readonly maxNotesPerHand?: number;
  /** Maximum inclusive MIDI span within either hand. Defaults to `12` semitones. */
  readonly maxHandSpan?: number;
  /** Hands to populate. Both hands may be empty individually; defaults to `'both'`. */
  readonly hands?: PianoVoicingHands;
  /** Whether practically optional chord tones may be omitted. Defaults to `'practical'`. */
  readonly omissions?: ChordOmissions;
};

/** An immutable piano voicing, with keys ordered from the lowest MIDI pitch. */
export type PianoVoicing = {
  /** Keys assigned to the left hand, in ascending MIDI order. */
  readonly leftHand: readonly PianoKey[];
  /** Keys assigned to the right hand, in ascending MIDI order. */
  readonly rightHand: readonly PianoKey[];
  /** Every played note, in ascending MIDI order. */
  readonly notes: readonly Note[];
  /** The lowest played note. */
  readonly bass: Note;
  /** Chord intervals absent from the played pitch classes. */
  readonly omittedIntervals: readonly Interval[];
};

type Snapshot = {
  readonly low: number;
  readonly high: number;
  readonly maxNotesPerHand: number;
  readonly maxHandSpan: number;
  readonly hands: PianoVoicingHands;
  readonly requirements: ReturnType<typeof chordRequirements>;
};

function validateInteger(name: string, value: number, minimum: number): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer greater than or equal to ${minimum}.`);
  }
}

function validateRange(range: KeyboardRange): { readonly low: number; readonly high: number } {
  const low = Number(range.from);
  const high = Number(range.to);
  if (!Number.isInteger(low) || !Number.isInteger(high) || low < 0 || high > 127 || low > high) {
    throw new RangeError('Expected a valid MIDI keyboard range from 0 through 127.');
  }
  return { low, high };
}

function resolveHands(value: PianoVoicingHands | undefined): PianoVoicingHands {
  const hands = value ?? 'both';
  if (hands !== 'both' && hands !== 'left' && hands !== 'right') {
    throw new TypeError("hands must be 'both', 'left', or 'right'.");
  }
  return hands;
}

function snapshotOptions(chord: Chord | string, options: PianoVoicingOptions): Snapshot {
  const range = options.range ?? KEYBOARD_88;
  const { low, high } = validateRange(range);
  const maxNotesPerHand = options.maxNotesPerHand ?? 5;
  validateInteger('maxNotesPerHand', maxNotesPerHand, 1);
  if (maxNotesPerHand > 5) {
    throw new RangeError('maxNotesPerHand must be between 1 and 5.');
  }
  const maxHandSpan = options.maxHandSpan ?? 12;
  validateInteger('maxHandSpan', maxHandSpan, 0);
  if (maxHandSpan > 127) throw new RangeError('maxHandSpan must not exceed 127.');
  const hands = resolveHands(options.hands);
  const omissions = options.omissions ?? 'practical';
  const requirements = chordRequirements(chord, omissions);
  return Object.freeze({
    low,
    high,
    maxNotesPerHand,
    maxHandSpan,
    hands,
    requirements,
  });
}

function spanWithin(keys: readonly PianoKey[], maxSpan: number): boolean {
  return keys.length < 2 || keys[keys.length - 1]!.midi - keys[0]!.midi <= maxSpan;
}

function makeVoicing(
  selected: readonly PianoKey[],
  split: number,
  omittedIntervals: readonly Interval[],
): PianoVoicing {
  const leftHand = Object.freeze(selected.slice(0, split));
  const rightHand = Object.freeze(selected.slice(split));
  const notes = Object.freeze(selected.map((key) => key.note));
  return Object.freeze({
    leftHand,
    rightHand,
    notes,
    bass: selected[0]!.note,
    omittedIntervals,
  });
}

/** Lazily yields every distinct, range-bounded piano voicing for a chord. */
export function pianoVoicingsFor(
  chord: Chord | string,
  options: PianoVoicingOptions = {},
): IterableIterator<PianoVoicing> {
  const snapshot = snapshotOptions(chord, options);
  const allowed = new Set(snapshot.requirements.pitchClasses);
  const required = new Set(snapshot.requirements.requiredPitchClasses);
  const keys = Object.freeze(
    Array.from({ length: snapshot.high - snapshot.low + 1 }, (_, offset) =>
      pianoKeyFor(createMidiKey(snapshot.low + offset)),
    )
      .filter((key) => allowed.has(key.chromaticIndex))
      .map((key) => Object.freeze(key)),
  );
  const slashBass = snapshot.requirements.chord.isSlashChord
    ? snapshot.requirements.chord.bass.chromaticIndex
    : null;
  const maxTotal =
    snapshot.hands === 'both' ? snapshot.maxNotesPerHand * 2 : snapshot.maxNotesPerHand;

  function* enumerate(): IterableIterator<PianoVoicing> {
    const selected: PianoKey[] = [];
    const present = new Map<number, number>();

    function* visit(start: number): IterableIterator<PianoVoicing> {
      yield* emitSelected();
      if (selected.length === maxTotal) return;
      for (let index = start; index < keys.length; index += 1) {
        const key = keys[index]!;
        selected.push(key);
        present.set(key.chromaticIndex, (present.get(key.chromaticIndex) ?? 0) + 1);
        if (canStillSatisfy(index + 1) && hasPotentialSplit()) yield* visit(index + 1);
        const count = present.get(key.chromaticIndex)!;
        if (count === 1) present.delete(key.chromaticIndex);
        else present.set(key.chromaticIndex, count - 1);
        selected.pop();
      }
    }

    function* emitSelected(): IterableIterator<PianoVoicing> {
      if (selected.length === 0 || !requiredIsSatisfied() || selected[0] === undefined) return;
      if (slashBass !== null && selected[0].chromaticIndex !== slashBass) return;
      const omittedIntervals = omittedIntervalsFor(
        snapshot.requirements,
        selected.map((key) => key.chromaticIndex),
      );
      if (omittedIntervals === null) return;
      for (let split = 0; split <= selected.length; split += 1) {
        if (validSplit(split)) yield makeVoicing(selected, split, omittedIntervals);
      }
    }

    function requiredIsSatisfied(): boolean {
      for (const pitchClass of required) if (!present.has(pitchClass)) return false;
      return true;
    }

    function canStillSatisfy(start: number): boolean {
      for (const pitchClass of required) {
        if (present.has(pitchClass)) continue;
        let available = false;
        for (let index = start; index < keys.length; index += 1) {
          if (keys[index]!.chromaticIndex === pitchClass) {
            available = true;
            break;
          }
        }
        if (!available) return false;
      }
      return true;
    }

    function validSplit(split: number): boolean {
      const left = selected.slice(0, split);
      const right = selected.slice(split);
      if (snapshot.hands === 'left' && right.length > 0) return false;
      if (snapshot.hands === 'right' && left.length > 0) return false;
      if (left.length > snapshot.maxNotesPerHand || right.length > snapshot.maxNotesPerHand)
        return false;
      return spanWithin(left, snapshot.maxHandSpan) && spanWithin(right, snapshot.maxHandSpan);
    }

    function hasPotentialSplit(): boolean {
      for (let split = 0; split <= selected.length; split += 1) {
        if (validSplit(split)) return true;
      }
      return false;
    }

    yield* visit(0);
  }

  return enumerate();
}
