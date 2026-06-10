import { describe, it, expect } from 'bun:test';
import { Sequence, musicalTime } from './sequence.js';
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

describe('Sequence.toJSON / fromJSON', () => {
  it('round-trips a note event sequence', () => {
    const original = Sequence.create(
      [
        noteEvent('C4', q(0, 1), QUARTER),
        noteEvent('E4', QUARTER, QUARTER, 64),
        restEvent(HALF, QUARTER),
      ],
      { tempo: 120 },
    );

    const json = original.toJSON();
    const restored = Sequence.fromJSON(json);

    expect(restored.equals(original)).toBe(true);
  });

  it('round-trips a chord event without velocity', () => {
    const original = Sequence.create([chordEvent('C4', 'maj7', q(0, 1), WHOLE)], { tempo: 80 });

    const json = original.toJSON();
    const restored = Sequence.fromJSON(json);

    expect(restored.equals(original)).toBe(true);
  });

  it('round-trips a chord event with velocity', () => {
    const original = Sequence.create([chordEvent('G4', '', q(0, 1), HALF, 90)], { tempo: 120 });

    const json = original.toJSON();
    const restored = Sequence.fromJSON(json);

    expect(restored.equals(original)).toBe(true);
    expect((restored.events[0] as ChordEvent).velocity).toBe(90);
  });

  it('produces deterministic JSON', () => {
    const seq = Sequence.create([noteEvent('C4', q(0, 1), QUARTER)], { tempo: 120 });
    const json1 = JSON.stringify(seq.toJSON());
    const json2 = JSON.stringify(seq.toJSON());

    expect(json1).toBe(json2);
  });

  it('throws TypeError for invalid tempo in fromJSON', () => {
    expect(() => Sequence.fromJSON({ tempo: 0, meter: null, events: [] })).toThrow(TypeError);
  });

  it('round-trips with a rest event', () => {
    const original = Sequence.create([restEvent(q(0, 1), QUARTER)], { tempo: 120 });
    const restored = Sequence.fromJSON(original.toJSON());

    expect(restored.equals(original)).toBe(true);
  });

  it('serializes meter as null when absent', () => {
    const seq = Sequence.create([], { tempo: 120 });
    expect(seq.toJSON().meter).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// equals
// ---------------------------------------------------------------------------

describe('Sequence.equals', () => {
  it('considers two empty sequences with same tempo equal', () => {
    const a = Sequence.create([], { tempo: 120 });
    const b = Sequence.create([], { tempo: 120 });
    expect(a.equals(b)).toBe(true);
  });

  it('considers two sequences unequal when tempos differ', () => {
    const a = Sequence.create([], { tempo: 120 });
    const b = Sequence.create([], { tempo: 96 });
    expect(a.equals(b)).toBe(false);
  });

  it('considers two sequences unequal when event counts differ', () => {
    const a = Sequence.create([noteEvent('C4', q(0, 1), QUARTER)], { tempo: 120 });
    const b = Sequence.create([], { tempo: 120 });
    expect(a.equals(b)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Symbol.toStringTag
// ---------------------------------------------------------------------------

describe('Sequence[Symbol.toStringTag]', () => {
  it('returns a descriptive tag', () => {
    const seq = Sequence.create([noteEvent('C4', q(0, 1), QUARTER)], { tempo: 120 });
    expect(seq[Symbol.toStringTag]).toBe('Sequence(1 event(s), 120 BPM)');
  });
});
