import { describe, it, expect } from 'bun:test';
import { Note } from '../note.js';
import { Chord } from '../chord.js';
import { Sequence, musicalTime } from '../sequences/sequence.js';
import { sequenceToMidiFile } from './encode.js';

// ---------------------------------------------------------------------------
// sequenceToMidiFile — velocity-0 rejection (Fix #5)
//
// A note-on with velocity 0 is treated as note-off by the MIDI spec.  The
// SMF encoder must reject velocity 0 on note AND chord events rather than
// silently emitting a note that is immediately muted.
// ---------------------------------------------------------------------------

describe('sequenceToMidiFile — velocity-0 rejection', () => {
  it('throws RangeError when a note event has velocity 0', () => {
    const c4 = Note.create({ note: 'C', octave: 4 });
    // prettier-ignore
    const noteVel0Seq = Sequence.create(
      [{ type: 'note', note: c4, start: musicalTime(0, 1), duration: musicalTime(1, 4), velocity: 0 }],
      { tempo: 120 },
    );
    expect(() => sequenceToMidiFile(noteVel0Seq)).toThrow(RangeError);
    expect(() => sequenceToMidiFile(noteVel0Seq)).toThrow(/0 is interpreted as note-off/);
  });

  it('throws RangeError when a chord event has velocity 0', () => {
    const cMaj = Chord.create({ note: 'C', octave: 4 }, 'major');
    // prettier-ignore
    const chordVel0Seq = Sequence.create(
      [{ type: 'chord', chord: cMaj, start: musicalTime(0, 1), duration: musicalTime(1, 4), velocity: 0 }],
      { tempo: 120 },
    );
    expect(() => sequenceToMidiFile(chordVel0Seq)).toThrow(RangeError);
    expect(() => sequenceToMidiFile(chordVel0Seq)).toThrow(/0 is interpreted as note-off/);
  });

  it('accepts note event velocity 1 (lower boundary)', () => {
    const c4 = Note.create({ note: 'C', octave: 4 });
    // prettier-ignore
    const noteVel1Seq = Sequence.create(
      [{ type: 'note', note: c4, start: musicalTime(0, 1), duration: musicalTime(1, 4), velocity: 1 }],
      { tempo: 120 },
    );
    expect(() => sequenceToMidiFile(noteVel1Seq)).not.toThrow();
  });

  it('accepts note event velocity 127 (upper boundary)', () => {
    const c4 = Note.create({ note: 'C', octave: 4 });
    // prettier-ignore
    const noteVel127Seq = Sequence.create(
      [{ type: 'note', note: c4, start: musicalTime(0, 1), duration: musicalTime(1, 4), velocity: 127 }],
      { tempo: 120 },
    );
    expect(() => sequenceToMidiFile(noteVel127Seq)).not.toThrow();
  });
});
