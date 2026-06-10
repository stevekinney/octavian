/**
 * Tests for createWebMidiInput.
 *
 * Uses explicitly-typed fake MIDIAccess / MIDIInput objects that implement the
 * *Like interfaces. Mocks are typed as the interface, not `any`, so a wrong
 * interface shape would be caught here rather than only by a real consumer.
 */

import { describe, it, expect } from 'bun:test';
import { createWebMidiInput } from './web-midi-input.js';
import type {
  MIDIAccessLike,
  MIDIInputLike,
  MIDIMessageEventLike,
  WebMidiInputController,
} from './types.js';
import type { MidiMessage } from '../midi/types.js';
import type { Note } from '../note.js';
import type { Chord } from '../chord.js';

// ---------------------------------------------------------------------------
// Fake MIDIInput factory
// ---------------------------------------------------------------------------

function makeFakeInput(): MIDIInputLike & {
  fire(data: Uint8Array | null): void;
} {
  const fake = {
    onmidimessage: null as ((event: MIDIMessageEventLike) => void) | null,
    fire(data: Uint8Array | null): void {
      const event: MIDIMessageEventLike = { data };
      if (fake.onmidimessage !== null) {
        fake.onmidimessage(event);
      }
    },
  };
  return fake;
}

function makeFakeAccess(inputs: MIDIInputLike[]): MIDIAccessLike {
  return {
    inputs: {
      values(): IterableIterator<MIDIInputLike> {
        return inputs[Symbol.iterator]();
      },
    },
  };
}

// ---------------------------------------------------------------------------
// MIDI byte helpers
// ---------------------------------------------------------------------------

/** Note-On: channel 0, note, velocity */
function noteOn(note: number, velocity: number): Uint8Array {
  return new Uint8Array([0x90, note, velocity]);
}

/** Note-Off: channel 0, note */
function noteOff(note: number): Uint8Array {
  return new Uint8Array([0x80, note, 0]);
}

/** Control Change: channel 0, controller, value */
function cc(controller: number, value: number): Uint8Array {
  return new Uint8Array([0xb0, controller, value]);
}

/** Program Change: channel 0, program */
function programChange(program: number): Uint8Array {
  return new Uint8Array([0xc0, program]);
}

// MIDI note numbers for common notes
const C4 = 60;
const E4 = 64;
const G4 = 67;
const A4 = 69;

// ---------------------------------------------------------------------------
// Basic binding and teardown
// ---------------------------------------------------------------------------

describe('createWebMidiInput — binding', () => {
  it('attaches onmidimessage to every input at creation', () => {
    const input1 = makeFakeInput();
    const input2 = makeFakeInput();
    const access = makeFakeAccess([input1, input2]);

    createWebMidiInput({ midiAccess: access });

    expect(input1.onmidimessage).not.toBeNull();
    expect(input2.onmidimessage).not.toBeNull();
  });

  it('stop() detaches handlers from all bound inputs', () => {
    const input1 = makeFakeInput();
    const input2 = makeFakeInput();
    const access = makeFakeAccess([input1, input2]);

    const controller = createWebMidiInput({ midiAccess: access });
    controller.stop();

    expect(input1.onmidimessage).toBeNull();
    expect(input2.onmidimessage).toBeNull();
  });

  it('dispose() is an alias for stop()', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);

    const controller = createWebMidiInput({ midiAccess: access });
    controller.dispose();

    expect(input.onmidimessage).toBeNull();
  });

  it('calling stop() twice is safe (no throw)', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);

    const controller = createWebMidiInput({ midiAccess: access });
    controller.stop();
    expect(() => controller.stop()).not.toThrow();
  });

  it('messages received after stop() are ignored', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const messages: MidiMessage[] = [];

    const controller = createWebMidiInput({
      midiAccess: access,
      onMessage: (m) => messages.push(m),
    });

    input.fire(noteOn(C4, 80));
    expect(messages).toHaveLength(1);

    controller.stop();
    input.fire(noteOn(E4, 80));
    expect(messages).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// onMessage callback
// ---------------------------------------------------------------------------

describe('createWebMidiInput — onMessage', () => {
  it('fires onMessage for every parsed message', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const messages: MidiMessage[] = [];

    createWebMidiInput({ midiAccess: access, onMessage: (m) => messages.push(m) });

    input.fire(noteOn(C4, 80));
    input.fire(noteOff(C4));
    input.fire(cc(64, 127));

    expect(messages).toHaveLength(3);
    expect(messages[0]?.type).toBe('noteOn');
    expect(messages[1]?.type).toBe('noteOff');
    expect(messages[2]?.type).toBe('controlChange');
  });

  it('fires onMessage for messages from multiple inputs', () => {
    const input1 = makeFakeInput();
    const input2 = makeFakeInput();
    const access = makeFakeAccess([input1, input2]);
    const messages: MidiMessage[] = [];

    createWebMidiInput({ midiAccess: access, onMessage: (m) => messages.push(m) });

    input1.fire(noteOn(C4, 80));
    input2.fire(noteOn(E4, 80));

    expect(messages).toHaveLength(2);
  });

  it('skips null data without throwing', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const messages: MidiMessage[] = [];

    createWebMidiInput({ midiAccess: access, onMessage: (m) => messages.push(m) });

    input.fire(null);
    expect(messages).toHaveLength(0);
  });

  it('skips empty data (length 0) without throwing', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const messages: MidiMessage[] = [];

    createWebMidiInput({ midiAccess: access, onMessage: (m) => messages.push(m) });

    input.fire(new Uint8Array([]));
    expect(messages).toHaveLength(0);
  });

  it('skips system messages (status >= 0xF0) without throwing', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const messages: MidiMessage[] = [];

    createWebMidiInput({ midiAccess: access, onMessage: (m) => messages.push(m) });

    // 0xF0 = SysEx start; 0xF8 = timing clock; 0xFE = active sensing.
    // All are valid MIDI but out of scope for the channel-voice adapter.
    input.fire(new Uint8Array([0xf0, 0x41, 0xf7]));
    input.fire(new Uint8Array([0xf8]));
    input.fire(new Uint8Array([0xfe]));
    expect(messages).toHaveLength(0);
  });

  it('skips a stray leading data byte (status < 0x80) without throwing', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const messages: MidiMessage[] = [];

    createWebMidiInput({ midiAccess: access, onMessage: (m) => messages.push(m) });

    // A first byte below 0x80 is a data byte, not a status byte — a running-
    // status continuation or corruption this adapter does not reassemble.
    // parseMidiMessage would throw; the guard must skip it silently instead.
    expect(() => input.fire(new Uint8Array([0x40, 0x50]))).not.toThrow();
    expect(messages).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// onNote callback
// ---------------------------------------------------------------------------

describe('createWebMidiInput — onNote', () => {
  it('fires onNote with note and message for noteOn', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const notes: Array<{ note: Note; message: MidiMessage }> = [];

    createWebMidiInput({
      midiAccess: access,
      onNote: (note, message) => notes.push({ note, message }),
    });

    input.fire(noteOn(C4, 80));

    expect(notes).toHaveLength(1);
    const first = notes[0];
    if (first === undefined) throw new Error('expected a note event.');
    expect(first.note.midi).toBe(C4);
    expect(first.message.type).toBe('noteOn');
  });

  it('fires onNote with note and message for noteOff', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const notes: Array<{ note: Note; message: MidiMessage }> = [];

    createWebMidiInput({
      midiAccess: access,
      onNote: (note, message) => notes.push({ note, message }),
    });

    input.fire(noteOn(C4, 80));
    input.fire(noteOff(C4));

    expect(notes).toHaveLength(2);
    expect(notes[1]?.message.type).toBe('noteOff');
  });

  it('does NOT fire onNote for non-note messages (programChange)', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const notes: Note[] = [];

    createWebMidiInput({
      midiAccess: access,
      onNote: (note) => notes.push(note),
    });

    input.fire(programChange(10));
    expect(notes).toHaveLength(0);
  });

  it('does NOT fire onNote for control change messages', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const notes: Note[] = [];

    createWebMidiInput({
      midiAccess: access,
      onNote: (note) => notes.push(note),
    });

    input.fire(cc(7, 100));
    expect(notes).toHaveLength(0);
  });

  it('respects accidentalPreference for note spelling', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const notes: Note[] = [];

    // A#4 / Bb4 = MIDI 70
    createWebMidiInput({
      midiAccess: access,
      accidentalPreference: 'flats',
      onNote: (note) => notes.push(note),
    });

    input.fire(noteOn(70, 80));
    expect(notes[0]?.note).toBe('Bb');
  });
});

// ---------------------------------------------------------------------------
// Active-note state (getNotes / getChord)
// ---------------------------------------------------------------------------

describe('createWebMidiInput — getNotes', () => {
  it('returns empty array when no notes are held', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const controller = createWebMidiInput({ midiAccess: access });

    expect(controller.getNotes()).toHaveLength(0);
  });

  it('tracks held notes after noteOn', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const controller = createWebMidiInput({ midiAccess: access });

    input.fire(noteOn(C4, 80));
    const notes = controller.getNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]?.midi).toBe(C4);
  });

  it('removes notes after noteOff', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const controller = createWebMidiInput({ midiAccess: access });

    input.fire(noteOn(C4, 80));
    input.fire(noteOff(C4));

    expect(controller.getNotes()).toHaveLength(0);
  });

  it('tracks multiple held notes', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const controller = createWebMidiInput({ midiAccess: access });

    input.fire(noteOn(C4, 80));
    input.fire(noteOn(E4, 80));
    input.fire(noteOn(G4, 80));

    expect(controller.getNotes()).toHaveLength(3);
  });
});

describe('createWebMidiInput — getChord', () => {
  it('returns null when no notes are held', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const controller = createWebMidiInput({ midiAccess: access });

    expect(controller.getChord()).toBeNull();
  });

  it('returns null with only one note', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const controller = createWebMidiInput({ midiAccess: access });

    input.fire(noteOn(C4, 80));
    expect(controller.getChord()).toBeNull();
  });

  it('identifies a C major chord (C E G)', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const controller = createWebMidiInput({ midiAccess: access });

    input.fire(noteOn(C4, 80));
    input.fire(noteOn(E4, 80));
    input.fire(noteOn(G4, 80));

    const chord = controller.getChord();
    expect(chord).not.toBeNull();
    expect(chord?.root.note).toBe('C');
  });
});

// ---------------------------------------------------------------------------
// onChord callback — change detection
// ---------------------------------------------------------------------------

describe('createWebMidiInput — onChord', () => {
  it('fires onChord when a chord becomes detectable (null → chord)', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const chords: Array<Chord | null> = [];

    createWebMidiInput({ midiAccess: access, onChord: (c) => chords.push(c) });

    // Single note — no chord yet
    input.fire(noteOn(C4, 80));
    expect(chords).toHaveLength(0);

    // Second note — still no known chord (C + E is not a catalogued chord by itself)
    input.fire(noteOn(E4, 80));

    // Third note — C major chord
    input.fire(noteOn(G4, 80));

    const lastChord = chords.at(-1);
    if (lastChord === null || lastChord === undefined) {
      throw new Error('expected a chord to be detected.');
    }
    expect(lastChord.root.note).toBe('C');
  });

  it('fires onChord when chord clears (chord → null)', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const chords: Array<Chord | null> = [];

    createWebMidiInput({ midiAccess: access, onChord: (c) => chords.push(c) });

    input.fire(noteOn(C4, 80));
    input.fire(noteOn(E4, 80));
    input.fire(noteOn(G4, 80));

    const beforeRelease = chords.length;

    input.fire(noteOff(G4));
    input.fire(noteOff(E4));
    input.fire(noteOff(C4));

    // At least one null emission after all notes released
    const nulls = chords.slice(beforeRelease).filter((c) => c === null);
    expect(nulls.length).toBeGreaterThan(0);
  });

  it('fires onChord when chord changes (chord → different chord)', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const chords: Array<Chord | null> = [];

    createWebMidiInput({ midiAccess: access, onChord: (c) => chords.push(c) });

    // C major: C E G
    input.fire(noteOn(C4, 80));
    input.fire(noteOn(E4, 80));
    input.fire(noteOn(G4, 80));

    const afterCMajor = chords.length;

    // Release G, add A → C minor 7th / Am
    input.fire(noteOff(G4));
    input.fire(noteOff(E4));
    input.fire(noteOn(A4, 80));

    // Should have fired at least once more
    expect(chords.length).toBeGreaterThan(afterCMajor);
  });

  it('does NOT fire onChord when chord is unchanged', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const chords: Array<Chord | null> = [];

    createWebMidiInput({ midiAccess: access, onChord: (c) => chords.push(c) });

    // C major
    input.fire(noteOn(C4, 80));
    input.fire(noteOn(E4, 80));
    input.fire(noteOn(G4, 80));

    const countAfterChord = chords.length;

    // Add C4 again (already held) — state does not change, chord does not change
    input.fire(noteOn(C4, 80));

    expect(chords.length).toBe(countAfterChord);
  });

  it('passes null to onChord when no notes are held (no chord detected)', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const chords: Array<Chord | null> = [];

    createWebMidiInput({ midiAccess: access, onChord: (c) => chords.push(c) });

    // Build and fully release a C major chord
    input.fire(noteOn(C4, 80));
    input.fire(noteOn(E4, 80));
    input.fire(noteOn(G4, 80));
    input.fire(noteOff(C4));
    input.fire(noteOff(E4));
    input.fire(noteOff(G4));

    const hasNull = chords.some((c) => c === null);
    expect(hasNull).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// No callbacks provided — still tracks state
// ---------------------------------------------------------------------------

describe('createWebMidiInput — no callbacks', () => {
  it('works without any callback options', () => {
    const input = makeFakeInput();
    const access = makeFakeAccess([input]);
    const controller: WebMidiInputController = createWebMidiInput({ midiAccess: access });

    input.fire(noteOn(C4, 80));
    input.fire(noteOn(E4, 80));
    input.fire(noteOn(G4, 80));

    expect(controller.getNotes()).toHaveLength(3);
    const chord = controller.getChord();
    expect(chord).not.toBeNull();
  });

  it('handles empty inputs map gracefully', () => {
    const access = makeFakeAccess([]);
    const controller = createWebMidiInput({ midiAccess: access });

    expect(controller.getNotes()).toHaveLength(0);
    expect(controller.getChord()).toBeNull();
    expect(() => controller.stop()).not.toThrow();
  });
});
