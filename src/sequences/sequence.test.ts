import { describe, it, expect } from 'bun:test';
import { Sequence, musicalTime } from './sequence.js';
import { Sequence as SequenceFromBarrel, musicalTime as musicalTimeFromBarrel } from './index.js';
import { Note } from '../note.js';
import { Chord } from '../chord.js';
import type { MusicEvent, NoteEvent, ChordEvent, RestEvent } from './types.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const q: typeof musicalTime = musicalTime; // quarter = 1/4
const QUARTER = q(1, 4);
const HALF = q(1, 2);
const WHOLE = q(1, 1);
const EIGHTH = q(1, 8);

function noteEvent(
  noteName: string,
  start: ReturnType<typeof q>,
  duration: ReturnType<typeof q>,
  velocity?: number,
): NoteEvent {
  const base: NoteEvent = {
    type: 'note',
    note: Note.create(noteName),
    start,
    duration,
  };

  if (velocity !== undefined) {
    return { ...base, velocity };
  }

  return base;
}

function chordEvent(
  root: string,
  suffix: string,
  start: ReturnType<typeof q>,
  duration: ReturnType<typeof q>,
  velocity?: number,
): ChordEvent {
  const base: ChordEvent = {
    type: 'chord',
    chord: Chord.create(Note.create(root), suffix),
    start,
    duration,
  };

  if (velocity !== undefined) {
    return { ...base, velocity };
  }

  return base;
}

function restEvent(start: ReturnType<typeof q>, duration: ReturnType<typeof q>): RestEvent {
  return { type: 'rest', start, duration };
}

// ---------------------------------------------------------------------------
// musicalTime helper
// ---------------------------------------------------------------------------

describe('musicalTime', () => {
  it('creates a reduced rational', () => {
    const t = musicalTime(2, 8);
    expect(t).toEqual({ numerator: 1, denominator: 4 });
  });

  it('throws RangeError for zero denominator', () => {
    expect(() => musicalTime(1, 0)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Sequence.create
// ---------------------------------------------------------------------------

describe('Sequence.create', () => {
  it('creates an empty sequence', () => {
    const seq = Sequence.create([], { tempo: 120 });
    expect(seq.isEmpty()).toBe(true);
    expect(seq.events).toHaveLength(0);
  });

  it('stores the tempo', () => {
    const seq = Sequence.create([], { tempo: 96 });
    expect(seq.tempo).toBe(96);
  });

  it('stores null meter when none given', () => {
    const seq = Sequence.create([], { tempo: 120 });
    expect(seq.meter).toBeNull();
  });

  it('sorts events by start ascending', () => {
    const events: MusicEvent[] = [
      noteEvent('E4', HALF, QUARTER),
      noteEvent('C4', q(0, 1), QUARTER),
    ];

    const seq = Sequence.create(events, { tempo: 120 });
    expect(seq.events[0]?.type).toBe('note');
    expect((seq.events[0] as NoteEvent).note.note).toBe('C');
    expect((seq.events[1] as NoteEvent).note.note).toBe('E');
  });

  it('preserves overlapping events (polyphony)', () => {
    const events: MusicEvent[] = [
      noteEvent('C4', q(0, 1), WHOLE),
      noteEvent('E4', q(0, 1), WHOLE),
      noteEvent('G4', q(0, 1), WHOLE),
    ];

    const seq = Sequence.create(events, { tempo: 120 });
    expect(seq.events).toHaveLength(3);
  });

  it('throws RangeError for invalid tempo (zero)', () => {
    expect(() => Sequence.create([], { tempo: 0 })).toThrow(RangeError);
  });

  it('throws RangeError for invalid tempo (negative)', () => {
    expect(() => Sequence.create([], { tempo: -60 })).toThrow(RangeError);
  });

  it('throws RangeError for velocity out of range', () => {
    const event = noteEvent('C4', q(0, 1), QUARTER, 200);
    expect(() => Sequence.create([event], { tempo: 120 })).toThrow(RangeError);
  });

  it('accepts velocity 0 (lower boundary)', () => {
    const event = noteEvent('C4', q(0, 1), QUARTER, 0);
    expect(() => Sequence.create([event], { tempo: 120 })).not.toThrow();
  });

  it('accepts velocity 127 (upper boundary)', () => {
    const event = noteEvent('C4', q(0, 1), QUARTER, 127);
    expect(() => Sequence.create([event], { tempo: 120 })).not.toThrow();
  });

  it('throws RangeError for velocity below 0', () => {
    const event = noteEvent('C4', q(0, 1), QUARTER, -1);
    expect(() => Sequence.create([event], { tempo: 120 })).toThrow(RangeError);
  });

  it('throws RangeError for non-integer velocity', () => {
    const event = noteEvent('C4', q(0, 1), QUARTER, 63.5);
    expect(() => Sequence.create([event], { tempo: 120 })).toThrow(RangeError);
  });

  it('throws RangeError for non-finite tempo (NaN)', () => {
    expect(() => Sequence.create([], { tempo: NaN })).toThrow(RangeError);
  });

  it('throws RangeError for non-finite tempo (Infinity)', () => {
    expect(() => Sequence.create([], { tempo: Infinity })).toThrow(RangeError);
  });

  it('throws TypeError for non-integer start numerator', () => {
    const event: NoteEvent = {
      type: 'note',
      note: Note.create('C4'),
      start: { numerator: 1.5, denominator: 4 },
      duration: QUARTER,
    };

    expect(() => Sequence.create([event], { tempo: 120 })).toThrow(TypeError);
  });

  it('throws RangeError for non-positive start denominator', () => {
    const event: NoteEvent = {
      type: 'note',
      note: Note.create('C4'),
      start: { numerator: 1, denominator: -4 },
      duration: QUARTER,
    };

    expect(() => Sequence.create([event], { tempo: 120 })).toThrow(RangeError);
  });

  it('throws TypeError for non-integer duration denominator', () => {
    const event: NoteEvent = {
      type: 'note',
      note: Note.create('C4'),
      start: q(0, 1),
      duration: { numerator: 1, denominator: 2.5 },
    };

    expect(() => Sequence.create([event], { tempo: 120 })).toThrow(TypeError);
  });

  it('throws RangeError for non-positive duration denominator', () => {
    const event: NoteEvent = {
      type: 'note',
      note: Note.create('C4'),
      start: q(0, 1),
      duration: { numerator: 1, denominator: 0 },
    };

    expect(() => Sequence.create([event], { tempo: 120 })).toThrow(RangeError);
  });

  it('throws RangeError for negative start time', () => {
    const event: NoteEvent = {
      type: 'note',
      note: Note.create('C4'),
      start: { numerator: -1, denominator: 4 },
      duration: QUARTER,
    };

    expect(() => Sequence.create([event], { tempo: 120 })).toThrow(RangeError);
  });

  it('throws RangeError for zero duration', () => {
    const event: NoteEvent = {
      type: 'note',
      note: Note.create('C4'),
      start: q(0, 1),
      duration: { numerator: 0, denominator: 1 },
    };

    expect(() => Sequence.create([event], { tempo: 120 })).toThrow(RangeError);
  });

  it('accepts rest events', () => {
    const seq = Sequence.create([restEvent(q(0, 1), QUARTER)], { tempo: 120 });
    expect(seq.events[0]?.type).toBe('rest');
  });

  it('accepts chord events', () => {
    const seq = Sequence.create([chordEvent('C4', '', q(0, 1), WHOLE)], { tempo: 120 });
    expect(seq.events[0]?.type).toBe('chord');
  });
});

// ---------------------------------------------------------------------------
// toAbsoluteSeconds — tempo conversion
// ---------------------------------------------------------------------------

describe('Sequence.toAbsoluteSeconds', () => {
  it('quarter note at 120 BPM = 0.5s', () => {
    const seq = Sequence.create([noteEvent('C4', QUARTER, QUARTER)], { tempo: 120 });
    const [timed] = seq.toAbsoluteSeconds();

    expect(timed?.startSeconds).toBeCloseTo(0.5);
    expect(timed?.durationSeconds).toBeCloseTo(0.5);
  });

  it('whole note at 60 BPM = 4s duration', () => {
    const seq = Sequence.create([noteEvent('C4', q(0, 1), WHOLE)], { tempo: 60 });
    const [timed] = seq.toAbsoluteSeconds();

    expect(timed?.durationSeconds).toBeCloseTo(4);
  });

  it('eighth note at 120 BPM = 0.25s', () => {
    const seq = Sequence.create([noteEvent('C4', q(0, 1), EIGHTH)], { tempo: 120 });
    const [timed] = seq.toAbsoluteSeconds();

    expect(timed?.durationSeconds).toBeCloseTo(0.25);
  });

  it('start = 0 has startSeconds = 0', () => {
    const seq = Sequence.create([noteEvent('C4', q(0, 1), QUARTER)], { tempo: 120 });
    const [timed] = seq.toAbsoluteSeconds();

    expect(timed?.startSeconds).toBeCloseTo(0);
  });

  it('returns timed events with same type discriminants', () => {
    const seq = Sequence.create(
      [
        noteEvent('C4', q(0, 1), QUARTER),
        chordEvent('F4', '', QUARTER, HALF),
        restEvent(q(3, 4), QUARTER),
      ],
      { tempo: 120 },
    );
    const timed = seq.toAbsoluteSeconds();

    expect(timed[0]?.type).toBe('note');
    expect(timed[1]?.type).toBe('chord');
    expect(timed[2]?.type).toBe('rest');
  });
});

// ---------------------------------------------------------------------------
// eventsInRange
// ---------------------------------------------------------------------------

describe('Sequence.eventsInRange', () => {
  const events: MusicEvent[] = [
    noteEvent('C4', q(0, 1), QUARTER),
    noteEvent('D4', QUARTER, QUARTER),
    noteEvent('E4', HALF, QUARTER),
    noteEvent('F4', q(3, 4), QUARTER),
  ];

  const seq = Sequence.create(events, { tempo: 120 });

  it('returns events within [0, 1/2)', () => {
    const result = seq.eventsInRange(q(0, 1), HALF);
    expect(result).toHaveLength(2);
    expect((result[0] as NoteEvent).note.note).toBe('C');
    expect((result[1] as NoteEvent).note.note).toBe('D');
  });

  it('is inclusive of startTime', () => {
    const result = seq.eventsInRange(HALF, WHOLE);
    expect(result).toHaveLength(2);
    expect((result[0] as NoteEvent).note.note).toBe('E');
  });

  it('is exclusive of endTime', () => {
    const result = seq.eventsInRange(q(0, 1), q(3, 4));
    expect(result).toHaveLength(3);
  });

  it('returns empty array when no events in range', () => {
    const result = seq.eventsInRange(q(2, 1), q(3, 1));
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// transpose
// ---------------------------------------------------------------------------

describe('Sequence.transpose', () => {
  it('transposes note events', () => {
    const seq = Sequence.create([noteEvent('C4', q(0, 1), QUARTER)], { tempo: 120 });
    const transposed = seq.transpose('majorSecond');

    expect((transposed.events[0] as NoteEvent).note.note).toBe('D');
  });

  it('transposes chord events', () => {
    const seq = Sequence.create([chordEvent('C4', '', q(0, 1), WHOLE)], { tempo: 120 });
    const transposed = seq.transpose('perfectFifth');

    expect((transposed.events[0] as ChordEvent).chord.root.note).toBe('G');
  });

  it('leaves rest events unchanged', () => {
    const seq = Sequence.create([restEvent(q(0, 1), QUARTER)], { tempo: 120 });
    const transposed = seq.transpose('majorSecond');

    expect(transposed.events[0]?.type).toBe('rest');
    expect(transposed.events[0]).toEqual(seq.events[0]);
  });

  it('preserves tempo and meter after transpose', () => {
    const seq = Sequence.create([noteEvent('C4', q(0, 1), QUARTER)], { tempo: 96 });
    const transposed = seq.transpose('minorThird');

    expect(transposed.tempo).toBe(96);
    expect(transposed.meter).toBeNull();
  });

  it('preserves velocity after transpose', () => {
    const seq = Sequence.create([noteEvent('C4', q(0, 1), QUARTER, 80)], { tempo: 120 });
    const transposed = seq.transpose('majorSecond');

    expect((transposed.events[0] as NoteEvent).velocity).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// totalDuration
// ---------------------------------------------------------------------------

describe('Sequence.totalDuration', () => {
  it('returns 0 for empty sequence', () => {
    const seq = Sequence.create([], { tempo: 120 });
    expect(seq.totalDuration()).toEqual({ numerator: 0, denominator: 1 });
  });

  it('returns start + duration of latest-ending event', () => {
    const seq = Sequence.create(
      [
        noteEvent('C4', q(0, 1), QUARTER), // ends at 1/4
        noteEvent('D4', QUARTER, HALF), // ends at 3/4
        noteEvent('E4', HALF, QUARTER), // ends at 3/4
      ],
      { tempo: 120 },
    );
    // Latest end is 3/4
    expect(seq.totalDuration()).toEqual({ numerator: 3, denominator: 4 });
  });
});

// ---------------------------------------------------------------------------
// Serialization round-trip
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Subpath barrel (index.js)
//
// Serialization, equality, Symbol.toStringTag, and meter coverage live in the
// companion file serialization.test.ts (kept separate to stay under the
// max-lines lint cap).
// ---------------------------------------------------------------------------

describe('octavian/sequences barrel exports', () => {
  it('exports Sequence from barrel', () => {
    expect(SequenceFromBarrel).toBe(Sequence);
  });

  it('exports musicalTime from barrel', () => {
    expect(musicalTimeFromBarrel).toBe(musicalTime);
  });

  it('barrel Sequence.create works end-to-end', () => {
    const seq = SequenceFromBarrel.create([noteEvent('C4', q(0, 1), QUARTER)], { tempo: 120 });
    expect(seq.events).toHaveLength(1);
  });
});
