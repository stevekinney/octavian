/**
 * Pure MIDI active-note state model.
 *
 * {@link applyMidiMessage} is a pure reducer: given the current state and an
 * incoming message it returns a new state object (no mutation). The state
 * tracks:
 *
 *  - Which notes are actively held by the performer (`heldNotes`).
 *  - Whether the sustain pedal (CC 64) is on (`sustainOn`).
 *  - Which notes are sustaining but no longer physically held
 *    (`sustainedNotes`): notes released while sustain is down remain
 *    "sounding" until sustain lifts.
 *
 * The "sounding" set (what you actually hear) = heldNotes ∪ sustainedNotes.
 * When the sustain pedal is lifted, sustainedNotes is cleared.
 */

import { Note } from '../note.js';
import { Chord } from '../chord.js';
import { findChordSuffixByIntervals } from '../chords.js';
import type { AccidentalPreference } from '../key-signatures.js';
import type { MidiMessage } from './types.js';
import { SUSTAIN_CONTROLLER, SUSTAIN_THRESHOLD } from './types.js';

// ---------------------------------------------------------------------------
// MidiState
// ---------------------------------------------------------------------------

/**
 * Immutable snapshot of the active-note state for one MIDI channel.
 *
 * Build an initial state with {@link createMidiState} and advance it with
 * {@link applyMidiMessage}.
 */
export type MidiState = {
  /**
   * MIDI note numbers (0..127) that are currently physically held down.
   * Represented as a `ReadonlySet` for O(1) membership tests.
   */
  readonly heldNotes: ReadonlySet<number>;

  /**
   * MIDI note numbers that were released while the sustain pedal was down.
   * These notes continue sounding until the pedal is lifted.
   */
  readonly sustainedNotes: ReadonlySet<number>;

  /**
   * `true` when CC 64 (sustain pedal) is currently on (value >= 64).
   */
  readonly sustainOn: boolean;
};

// ---------------------------------------------------------------------------
// createMidiState
// ---------------------------------------------------------------------------

/**
 * Creates an empty initial {@link MidiState} with no held notes and sustain off.
 *
 * @returns A fresh MIDI state.
 */
export function createMidiState(): MidiState {
  return {
    heldNotes: new Set(),
    sustainedNotes: new Set(),
    sustainOn: false,
  };
}

// ---------------------------------------------------------------------------
// applyMidiMessage
// ---------------------------------------------------------------------------

function applyNoteOn(state: MidiState, noteNumber: number): MidiState {
  const heldNotes = new Set(state.heldNotes);
  heldNotes.add(noteNumber);

  // Also remove from sustainedNotes (re-striking a sustained note resets it).
  const sustainedNotes = new Set(state.sustainedNotes);
  sustainedNotes.delete(noteNumber);

  return { heldNotes, sustainedNotes, sustainOn: state.sustainOn };
}

function applyNoteOff(state: MidiState, noteNumber: number): MidiState {
  const heldNotes = new Set(state.heldNotes);
  heldNotes.delete(noteNumber);

  if (state.sustainOn) {
    // Sustain is on: move to sustained set rather than removing from sounding.
    const sustainedNotes = new Set(state.sustainedNotes);
    sustainedNotes.add(noteNumber);
    return { heldNotes, sustainedNotes, sustainOn: true };
  }

  return { heldNotes, sustainedNotes: state.sustainedNotes, sustainOn: false };
}

function applySustainOn(state: MidiState): MidiState {
  return { heldNotes: state.heldNotes, sustainedNotes: state.sustainedNotes, sustainOn: true };
}

function applySustainOff(state: MidiState): MidiState {
  // Lift pedal: all sustained-but-released notes stop sounding.
  return { heldNotes: state.heldNotes, sustainedNotes: new Set(), sustainOn: false };
}

/**
 * Pure reducer: returns a new {@link MidiState} after applying `message`.
 *
 * Note-On adds to `heldNotes`; Note-Off (or Note-On velocity=0) removes from
 * `heldNotes`, moving the note to `sustainedNotes` if the sustain pedal is
 * currently on. When CC 64 goes below the sustain threshold, `sustainedNotes`
 * is cleared. All other message types leave the state unchanged.
 *
 * @param state The current state.
 * @param message The MIDI message to apply.
 * @returns A new state (the input is never mutated).
 */
export function applyMidiMessage(state: MidiState, message: MidiMessage): MidiState {
  if (message.type === 'noteOn') {
    return applyNoteOn(state, message.note);
  }

  if (message.type === 'noteOff') {
    return applyNoteOff(state, message.note);
  }

  if (message.type === 'controlChange' && message.controller === SUSTAIN_CONTROLLER) {
    if (message.value >= SUSTAIN_THRESHOLD) {
      return applySustainOn(state);
    }
    return applySustainOff(state);
  }

  return state;
}

// ---------------------------------------------------------------------------
// notesFromActiveMidiState
// ---------------------------------------------------------------------------

/**
 * Options for note-query helpers.
 */
export type ActiveMidiStateOptions = {
  /**
   * Whether to prefer sharps or flats when spelling notes.
   * Defaults to `'sharps'`.
   */
  readonly accidentalPreference?: AccidentalPreference;
};

/**
 * Returns every currently-sounding {@link Note} from the given MIDI state.
 *
 * "Sounding" includes both held notes and notes that are being sustained
 * by the sustain pedal. The result is sorted by MIDI note number ascending.
 *
 * @param state The current MIDI state.
 * @param options Spelling preference for accidentals.
 * @returns A sorted, frozen array of sounding notes.
 */
export function notesFromActiveMidiState(
  state: MidiState,
  options?: ActiveMidiStateOptions,
): readonly Note[] {
  const preference = options?.accidentalPreference ?? 'sharps';

  const allNoteNumbers = new Set([...state.heldNotes, ...state.sustainedNotes]);
  const sorted = [...allNoteNumbers].toSorted((a, b) => a - b);

  return Object.freeze(sorted.map((n) => Note.fromMidi(n, preference)));
}

// ---------------------------------------------------------------------------
// chordFromActiveMidiState
// ---------------------------------------------------------------------------

/**
 * Attempts to identify a chord from the currently-sounding notes.
 *
 * The lowest sounding note (by MIDI number) is used as the root candidate.
 * Intervals from that root to each other sounding note are computed and
 * matched against the chord catalog. Returns `null` when fewer than 2 notes
 * are sounding or the pitch-class set does not match a known chord.
 *
 * @param state The current MIDI state.
 * @param options Spelling preference for accidentals.
 * @returns The identified chord, or `null`.
 */
export function chordFromActiveMidiState(
  state: MidiState,
  options?: ActiveMidiStateOptions,
): Chord | null {
  const notes = notesFromActiveMidiState(state, options);

  if (notes.length < 2) {
    return null;
  }

  // Deduplicate by pitch class (chromatic index) to avoid octave duplicates
  // confusing interval calculation, then sort ascending.
  const seen = new Set<number>();
  const deduped: Note[] = [];
  for (const note of notes) {
    if (!seen.has(note.chromaticIndex)) {
      seen.add(note.chromaticIndex);
      deduped.push(note);
    }
  }

  if (deduped.length < 2) return null;

  const dedupedRoot = deduped[0];
  if (!dedupedRoot) return null;

  // Map every note (including root) to its distance from the root; root gives 'perfectUnison'.
  // This matches the convention in the chord catalog where intervals[0] = 'perfectUnison'.
  const intervals = deduped.map((note) => dedupedRoot.distanceTo(note));
  const suffix = findChordSuffixByIntervals(intervals);

  if (!suffix) {
    return null;
  }

  return Chord.create(dedupedRoot, suffix);
}
