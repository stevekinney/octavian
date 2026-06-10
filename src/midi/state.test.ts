/**
 * Tests for the active-note state model and sequence converter.
 *
 * Ground truth values are asserted against MIDI specification byte values and
 * known music-theory relationships, not self-consistent recomputations.
 */

import { describe, it, expect } from 'bun:test';
import { Note } from '../note.js';
import { Chord } from '../chord.js';
import { Sequence, musicalTime } from '../sequences/sequence.js';
import {
  createMidiState,
  applyMidiMessage,
  notesFromActiveMidiState,
  chordFromActiveMidiState,
} from './state.js';
import { sequenceToMidiMessages } from './sequence-converter.js';
import { parseMidiMessage } from './parse.js';

// ---------------------------------------------------------------------------
// createMidiState
// ---------------------------------------------------------------------------

describe('createMidiState', () => {
  it('returns an empty initial state', () => {
    const state = createMidiState();
    expect(state.heldNotes.size).toBe(0);
    expect(state.sustainedNotes.size).toBe(0);
    expect(state.sustainOn).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyMidiMessage — basic noteOn / noteOff
// ---------------------------------------------------------------------------

describe('applyMidiMessage — basic note on/off', () => {
  it('adds a note to heldNotes on noteOn', () => {
    const state = applyMidiMessage(createMidiState(), parseMidiMessage([0x90, 60, 100]));
    expect(state.heldNotes.has(60)).toBe(true);
  });

  it('removes a note from heldNotes on noteOff', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0x80, 60, 64]));
    expect(state.heldNotes.has(60)).toBe(false);
  });

  it('Note-On vel=0 removes note like a noteOff', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 0]));
    expect(state.heldNotes.has(60)).toBe(false);
  });

  it('holds multiple notes simultaneously', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0x90, 64, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0x90, 67, 100]));
    expect(state.heldNotes.has(60)).toBe(true);
    expect(state.heldNotes.has(64)).toBe(true);
    expect(state.heldNotes.has(67)).toBe(true);
  });

  it('does not affect sustainedNotes when releasing without sustain', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0x80, 60, 0]));
    expect(state.sustainedNotes.size).toBe(0);
  });

  it('leaves state unchanged for non-note messages (pitch bend)', () => {
    const initial = createMidiState();
    const state = applyMidiMessage(initial, parseMidiMessage([0xe0, 0x00, 0x40]));
    expect(state).toBe(initial);
  });

  it('leaves state unchanged for non-note messages (program change)', () => {
    const initial = createMidiState();
    const state = applyMidiMessage(initial, parseMidiMessage([0xc0, 5]));
    expect(state).toBe(initial);
  });

  it('leaves state unchanged for non-sustain CC', () => {
    const initial = createMidiState();
    const state = applyMidiMessage(initial, parseMidiMessage([0xb0, 7, 100]));
    expect(state).toBe(initial);
  });
});

// ---------------------------------------------------------------------------
// applyMidiMessage — sustain pedal (CC 64)
// ---------------------------------------------------------------------------

describe('applyMidiMessage — sustain pedal', () => {
  it('sets sustainOn when CC64 value >= 64', () => {
    const state = applyMidiMessage(createMidiState(), parseMidiMessage([0xb0, 64, 127]));
    expect(state.sustainOn).toBe(true);
  });

  it('sets sustainOn at exactly the threshold (64)', () => {
    const state = applyMidiMessage(createMidiState(), parseMidiMessage([0xb0, 64, 64]));
    expect(state.sustainOn).toBe(true);
  });

  it('does not set sustainOn when CC64 value < 64', () => {
    const state = applyMidiMessage(createMidiState(), parseMidiMessage([0xb0, 64, 63]));
    expect(state.sustainOn).toBe(false);
  });

  it('clears sustainedNotes when sustain is released', () => {
    let state = createMidiState();
    // Press note, engage sustain, release note → note moves to sustainedNotes.
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0xb0, 64, 127]));
    state = applyMidiMessage(state, parseMidiMessage([0x80, 60, 0]));
    expect(state.sustainedNotes.has(60)).toBe(true);
    // Release sustain → sustainedNotes cleared.
    state = applyMidiMessage(state, parseMidiMessage([0xb0, 64, 0]));
    expect(state.sustainedNotes.size).toBe(0);
    expect(state.sustainOn).toBe(false);
  });

  it('noteOn then sustain-on then noteOff keeps note in sustainedNotes until pedal lift', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0xb0, 64, 127]));
    state = applyMidiMessage(state, parseMidiMessage([0x80, 60, 0]));
    // Note should still be "sounding" via sustain.
    expect(state.heldNotes.has(60)).toBe(false);
    expect(state.sustainedNotes.has(60)).toBe(true);
  });

  it('re-striking a sustained note removes it from sustainedNotes', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0xb0, 64, 127]));
    state = applyMidiMessage(state, parseMidiMessage([0x80, 60, 0]));
    // Re-strike note.
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 80]));
    expect(state.heldNotes.has(60)).toBe(true);
    expect(state.sustainedNotes.has(60)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// notesFromActiveMidiState
// ---------------------------------------------------------------------------

describe('notesFromActiveMidiState', () => {
  it('returns empty array when no notes are sounding', () => {
    expect(notesFromActiveMidiState(createMidiState())).toHaveLength(0);
  });

  it('returns held notes sorted by MIDI number ascending', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 67, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0x90, 64, 100]));
    const notes = notesFromActiveMidiState(state);
    expect(notes).toHaveLength(3);
    expect(notes[0]!.midi).toBe(60);
    expect(notes[1]!.midi).toBe(64);
    expect(notes[2]!.midi).toBe(67);
  });

  it('includes sustained notes', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0xb0, 64, 127]));
    state = applyMidiMessage(state, parseMidiMessage([0x80, 60, 0]));
    const notes = notesFromActiveMidiState(state);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.midi).toBe(60);
  });

  it('deduplicates notes that are both held and sustained', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0xb0, 64, 127]));
    // Note 60 is held. It should appear once.
    const notes = notesFromActiveMidiState(state);
    expect(notes).toHaveLength(1);
  });

  it('respects accidentalPreference flats', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 61, 100]));
    const notesFlat = notesFromActiveMidiState(state, { accidentalPreference: 'flats' });
    expect(notesFlat[0]!.note).toBe('Db');
    const notesSharp = notesFromActiveMidiState(state, { accidentalPreference: 'sharps' });
    expect(notesSharp[0]!.note).toBe('C#');
  });
});

// ---------------------------------------------------------------------------
// chordFromActiveMidiState
// ---------------------------------------------------------------------------

describe('chordFromActiveMidiState', () => {
  it('returns null when no notes are sounding', () => {
    expect(chordFromActiveMidiState(createMidiState())).toBeNull();
  });

  it('returns null when only one note is sounding', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    expect(chordFromActiveMidiState(state)).toBeNull();
  });

  it('identifies C major (MIDI 60, 64, 67) as a major chord rooted on C', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100])); // C4
    state = applyMidiMessage(state, parseMidiMessage([0x90, 64, 100])); // E4
    state = applyMidiMessage(state, parseMidiMessage([0x90, 67, 100])); // G4
    const chord = chordFromActiveMidiState(state);
    expect(chord).not.toBeNull();
    expect(chord!.root.note).toBe('C');
    expect(chord!.suffix).toBe('major');
  });

  it('identifies A minor (MIDI 57, 60, 64) as a minor chord rooted on A', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 57, 100])); // A3
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100])); // C4
    state = applyMidiMessage(state, parseMidiMessage([0x90, 64, 100])); // E4
    const chord = chordFromActiveMidiState(state);
    expect(chord).not.toBeNull();
    expect(chord!.root.note).toBe('A');
    expect(chord!.suffix).toBe('minor');
  });

  it('returns null for two notes that do not form a recognisable chord', () => {
    let state = createMidiState();
    // Tritone — not a catalogued chord.
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0x90, 66, 100]));
    expect(chordFromActiveMidiState(state)).toBeNull();
  });

  it('chord capture survives sustain: hold C-E-G, sustain on, release all → C major still detected', () => {
    let state = createMidiState();
    state = applyMidiMessage(state, parseMidiMessage([0x90, 60, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0x90, 64, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0x90, 67, 100]));
    state = applyMidiMessage(state, parseMidiMessage([0xb0, 64, 127]));
    state = applyMidiMessage(state, parseMidiMessage([0x80, 60, 0]));
    state = applyMidiMessage(state, parseMidiMessage([0x80, 64, 0]));
    state = applyMidiMessage(state, parseMidiMessage([0x80, 67, 0]));
    const chord = chordFromActiveMidiState(state);
    expect(chord).not.toBeNull();
    expect(chord!.suffix).toBe('major');
    // Lift sustain — chord should disappear.
    state = applyMidiMessage(state, parseMidiMessage([0xb0, 64, 0]));
    expect(chordFromActiveMidiState(state)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// sequenceToMidiMessages
// ---------------------------------------------------------------------------

describe('sequenceToMidiMessages', () => {
  it('produces note-on and note-off for a single note event', () => {
    const note = Note.fromMidi(60);
    const seq = Sequence.create(
      [{ type: 'note', note, start: musicalTime(0, 1), duration: musicalTime(1, 4), velocity: 80 }],
      { tempo: 120 },
    );
    const messages = sequenceToMidiMessages(seq);
    // At 120 BPM, quarter note = 0.5 s.
    const noteOns = messages.filter((m) => m.message.type === 'noteOn');
    const noteOffs = messages.filter((m) => m.message.type === 'noteOff');
    expect(noteOns).toHaveLength(1);
    expect(noteOffs).toHaveLength(1);
    expect(noteOns[0]!.message.type).toBe('noteOn');
    if (noteOns[0]!.message.type === 'noteOn') {
      expect(noteOns[0]!.message.note).toBe(60);
      expect(noteOns[0]!.message.velocity).toBe(80);
    }
    expect(noteOns[0]!.timeSeconds).toBeCloseTo(0);
    expect(noteOffs[0]!.timeSeconds).toBeCloseTo(0.5);
  });

  it('uses default velocity 64 when event has no velocity', () => {
    const note = Note.fromMidi(60);
    const seq = Sequence.create(
      [{ type: 'note', note, start: musicalTime(0, 1), duration: musicalTime(1, 4) }],
      { tempo: 120 },
    );
    const messages = sequenceToMidiMessages(seq);
    const noteOn = messages.find((m) => m.message.type === 'noteOn');
    expect(noteOn).toBeDefined();
    if (noteOn?.message.type === 'noteOn') {
      expect(noteOn.message.velocity).toBe(64);
    }
  });

  it('uses provided defaultVelocity option', () => {
    const note = Note.fromMidi(60);
    const seq = Sequence.create(
      [{ type: 'note', note, start: musicalTime(0, 1), duration: musicalTime(1, 4) }],
      { tempo: 120 },
    );
    const messages = sequenceToMidiMessages(seq, { defaultVelocity: 100 });
    const noteOn = messages.find((m) => m.message.type === 'noteOn');
    if (noteOn?.message.type === 'noteOn') {
      expect(noteOn.message.velocity).toBe(100);
    }
  });

  it('uses the provided channel option', () => {
    const note = Note.fromMidi(60);
    const seq = Sequence.create(
      [{ type: 'note', note, start: musicalTime(0, 1), duration: musicalTime(1, 4) }],
      { tempo: 120 },
    );
    const messages = sequenceToMidiMessages(seq, { channel: 9 });
    for (const { message } of messages) {
      expect(message.channel).toBe(9);
    }
  });

  it('skips rest events', () => {
    const seq = Sequence.create(
      [{ type: 'rest', start: musicalTime(0, 1), duration: musicalTime(1, 4) }],
      { tempo: 120 },
    );
    expect(sequenceToMidiMessages(seq)).toHaveLength(0);
  });

  it('expands chord events into per-note messages', () => {
    const chord = Chord.create('C4', 'major');
    const seq = Sequence.create(
      [
        {
          type: 'chord',
          chord,
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
          velocity: 90,
        },
      ],
      { tempo: 120 },
    );
    const messages = sequenceToMidiMessages(seq);
    const noteOns = messages.filter((m) => m.message.type === 'noteOn');
    // C major triad has 3 notes.
    expect(noteOns).toHaveLength(3);
  });

  it('returns messages sorted by timeSeconds ascending', () => {
    const noteA = Note.fromMidi(60);
    const noteB = Note.fromMidi(62);
    const seq = Sequence.create(
      [
        { type: 'note', note: noteB, start: musicalTime(1, 4), duration: musicalTime(1, 4) },
        { type: 'note', note: noteA, start: musicalTime(0, 1), duration: musicalTime(1, 4) },
      ],
      { tempo: 120 },
    );
    const messages = sequenceToMidiMessages(seq);
    for (let i = 1; i < messages.length; i += 1) {
      expect(messages[i]!.timeSeconds).toBeGreaterThanOrEqual(messages[i - 1]!.timeSeconds);
    }
  });

  it('returns frozen array', () => {
    const seq = Sequence.create([], { tempo: 120 });
    const messages = sequenceToMidiMessages(seq);
    expect(Object.isFrozen(messages)).toBe(true);
  });

  // Fix #3: option validation
  it('throws RangeError for channel 16', () => {
    const seq = Sequence.create([], { tempo: 120 });
    expect(() => sequenceToMidiMessages(seq, { channel: 16 })).toThrow(RangeError);
    expect(() => sequenceToMidiMessages(seq, { channel: 16 })).toThrow(/0..15/);
  });

  it('throws RangeError for channel -1', () => {
    const seq = Sequence.create([], { tempo: 120 });
    expect(() => sequenceToMidiMessages(seq, { channel: -1 })).toThrow(RangeError);
  });

  it('throws RangeError for defaultVelocity 0', () => {
    const seq = Sequence.create([], { tempo: 120 });
    expect(() => sequenceToMidiMessages(seq, { defaultVelocity: 0 })).toThrow(RangeError);
    expect(() => sequenceToMidiMessages(seq, { defaultVelocity: 0 })).toThrow(/1..127/);
  });

  it('throws RangeError for defaultVelocity 200', () => {
    const seq = Sequence.create([], { tempo: 120 });
    expect(() => sequenceToMidiMessages(seq, { defaultVelocity: 200 })).toThrow(RangeError);
  });

  // Fix #4: velocity-0 rejection at MIDI conversion boundary
  it('throws RangeError when a note event has velocity 0', () => {
    const note = Note.fromMidi(60);
    const seq = Sequence.create(
      [{ type: 'note', note, start: musicalTime(0, 1), duration: musicalTime(1, 4), velocity: 0 }],
      { tempo: 120 },
    );
    expect(() => sequenceToMidiMessages(seq)).toThrow(RangeError);
    expect(() => sequenceToMidiMessages(seq)).toThrow(/0 is interpreted as note-off/);
  });

  it('throws RangeError when a chord event has velocity 0', () => {
    const chord = Chord.create('C4', 'major');
    const seq = Sequence.create(
      [
        {
          type: 'chord',
          chord,
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
          velocity: 0,
        },
      ],
      { tempo: 120 },
    );
    expect(() => sequenceToMidiMessages(seq)).toThrow(RangeError);
    expect(() => sequenceToMidiMessages(seq)).toThrow(/0 is interpreted as note-off/);
  });

  it('accepts note event velocity 1 (boundary)', () => {
    const note = Note.fromMidi(60);
    const seq = Sequence.create(
      [{ type: 'note', note, start: musicalTime(0, 1), duration: musicalTime(1, 4), velocity: 1 }],
      { tempo: 120 },
    );
    expect(() => sequenceToMidiMessages(seq)).not.toThrow();
  });

  it('accepts note event velocity 127 (boundary)', () => {
    const note = Note.fromMidi(60);
    const seq = Sequence.create(
      [
        {
          type: 'note',
          note,
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
          velocity: 127,
        },
      ],
      { tempo: 120 },
    );
    expect(() => sequenceToMidiMessages(seq)).not.toThrow();
  });
});
