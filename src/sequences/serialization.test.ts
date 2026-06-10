import { describe, it, expect } from 'bun:test';
import { Sequence, musicalTime } from './sequence.js';
import { Note } from '../note.js';
import { Chord } from '../chord.js';
import { Meter } from '../meter.js';
import type { NoteEvent, ChordEvent } from './types.js';

// ---------------------------------------------------------------------------
// Test fixtures (shared shape with sequence.test.ts)
// ---------------------------------------------------------------------------

const q: typeof musicalTime = musicalTime; // quarter = 1/4
const QUARTER = q(1, 4);
const HALF = q(1, 2);
const WHOLE = q(1, 1);

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

function restEvent(
  start: ReturnType<typeof q>,
  duration: ReturnType<typeof q>,
): { type: 'rest'; start: ReturnType<typeof q>; duration: ReturnType<typeof q> } {
  return { type: 'rest', start, duration };
}

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

  it('throws RangeError for invalid tempo (zero) in fromJSON', () => {
    expect(() => Sequence.fromJSON({ tempo: 0, meter: null, events: [] })).toThrow(RangeError);
  });

  it('throws RangeError for non-finite tempo (NaN) in fromJSON', () => {
    expect(() => Sequence.fromJSON({ tempo: NaN, meter: null, events: [] })).toThrow(RangeError);
  });

  it('throws TypeError for an unknown serialized event type', () => {
    expect(() =>
      Sequence.fromJSON({
        tempo: 120,
        meter: null,
        // Unknown discriminant smuggled past the type system at the JSON boundary.
        events: [{ type: 'glissando', start: q(0, 1), duration: QUARTER }] as never,
      }),
    ).toThrow(TypeError);
  });

  it('round-trips a mixed sequence with all event types, velocities, and meter', () => {
    const meter = Meter.create('6/8');
    const original = Sequence.create(
      [
        noteEvent('C4', q(0, 1), QUARTER, 80),
        chordEvent('F4', 'maj7', QUARTER, HALF, 64),
        restEvent(q(3, 4), QUARTER),
      ],
      { tempo: 120, meter },
    );

    const restored = Sequence.fromJSON(original.toJSON());

    expect(restored.equals(original)).toBe(true);
    expect(restored.meter).toBeInstanceOf(Meter);
    expect(restored.meter?.numerator).toBe(6);
    expect((restored.events[0] as NoteEvent).velocity).toBe(80);
    expect((restored.events[1] as ChordEvent).velocity).toBe(64);
    // suffix round-trips as the canonical form ('maj7' is an alias of 'majorSeventh').
    expect((restored.events[1] as ChordEvent).chord.suffix).toBe('majorSeventh');
  });

  it('round-trips with a rest event', () => {
    const original = Sequence.create([restEvent(q(0, 1), QUARTER)], { tempo: 120 });
    const restored = Sequence.fromJSON(original.toJSON());

    expect(restored.equals(original)).toBe(true);
  });

  it('round-trips an inverted chord, preserving the inversion index', () => {
    const firstInversion = Chord.create(Note.create('C4'), 'maj7').invert();
    expect(firstInversion.inversionIndex).toBe(1);

    const original = Sequence.create(
      [{ type: 'chord', chord: firstInversion, start: q(0, 1), duration: WHOLE }],
      { tempo: 120 },
    );

    const restored = Sequence.fromJSON(original.toJSON());

    expect(restored.equals(original)).toBe(true);
    expect((restored.events[0] as ChordEvent).chord.inversionIndex).toBe(1);
  });

  it('omits the inversion field for a root-position chord', () => {
    const seq = Sequence.create([chordEvent('C4', 'maj7', q(0, 1), WHOLE)], { tempo: 120 });
    const serialized = seq.toJSON().events[0] as { inversion?: number };

    expect(serialized.inversion).toBeUndefined();
  });

  it('throws RangeError for an out-of-range serialized chord inversion', () => {
    expect(() =>
      Sequence.fromJSON({
        tempo: 120,
        meter: null,
        events: [
          {
            type: 'chord',
            rootWithOctave: 'C4',
            suffix: 'major',
            // A major triad has 3 notes; inversion 9 is out of range.
            inversion: 9,
            start: q(0, 1),
            duration: WHOLE,
          },
        ],
      }),
    ).toThrow(RangeError);
  });

  it('throws TypeError for a non-integer serialized chord inversion', () => {
    expect(() =>
      Sequence.fromJSON({
        tempo: 120,
        meter: null,
        events: [
          {
            type: 'chord',
            rootWithOctave: 'C4',
            suffix: 'major',
            inversion: 1.5,
            start: q(0, 1),
            duration: WHOLE,
          },
        ],
      }),
    ).toThrow(TypeError);
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

  it('considers two sequences unequal when event types differ at the same position', () => {
    const a = Sequence.create([noteEvent('C4', q(0, 1), QUARTER)], { tempo: 120 });
    const b = Sequence.create([restEvent(q(0, 1), QUARTER)], { tempo: 120 });
    expect(a.equals(b)).toBe(false);
  });

  it('considers two sequences unequal when note names differ', () => {
    const a = Sequence.create([noteEvent('C4', q(0, 1), QUARTER)], { tempo: 120 });
    const b = Sequence.create([noteEvent('D4', q(0, 1), QUARTER)], { tempo: 120 });
    expect(a.equals(b)).toBe(false);
  });

  it('considers two sequences unequal when note velocities differ', () => {
    const a = Sequence.create([noteEvent('C4', q(0, 1), QUARTER, 80)], { tempo: 120 });
    const b = Sequence.create([noteEvent('C4', q(0, 1), QUARTER, 90)], { tempo: 120 });
    expect(a.equals(b)).toBe(false);
  });

  it('considers two sequences unequal when event start times differ', () => {
    const a = Sequence.create([noteEvent('C4', q(0, 1), QUARTER)], { tempo: 120 });
    const b = Sequence.create([noteEvent('C4', QUARTER, QUARTER)], { tempo: 120 });
    expect(a.equals(b)).toBe(false);
  });

  it('considers two sequences unequal when event durations differ', () => {
    const a = Sequence.create([noteEvent('C4', q(0, 1), QUARTER)], { tempo: 120 });
    const b = Sequence.create([noteEvent('C4', q(0, 1), HALF)], { tempo: 120 });
    expect(a.equals(b)).toBe(false);
  });

  it('considers two sequences unequal when chord suffixes differ', () => {
    const a = Sequence.create([chordEvent('C4', 'maj7', q(0, 1), WHOLE)], { tempo: 120 });
    const b = Sequence.create([chordEvent('C4', '', q(0, 1), WHOLE)], { tempo: 120 });
    expect(a.equals(b)).toBe(false);
  });

  it('considers two sequences unequal when chord inversions differ', () => {
    const rootPosition: ChordEvent = {
      type: 'chord',
      chord: Chord.create(Note.create('C4'), 'maj7'),
      start: q(0, 1),
      duration: WHOLE,
    };
    const firstInversion: ChordEvent = {
      type: 'chord',
      chord: Chord.create(Note.create('C4'), 'maj7').invert(),
      start: q(0, 1),
      duration: WHOLE,
    };
    const a = Sequence.create([rootPosition], { tempo: 120 });
    const b = Sequence.create([firstInversion], { tempo: 120 });
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

// ---------------------------------------------------------------------------
// Meter option
// ---------------------------------------------------------------------------

describe('Sequence with meter', () => {
  it('stores the meter when provided', () => {
    const meter = Meter.create('4/4');
    const seq = Sequence.create([], { tempo: 120, meter });
    expect(seq.meter).not.toBeNull();
    expect(seq.meter?.numerator).toBe(4);
    expect(seq.meter?.denominator).toBe(4);
  });

  it('uses meter.beatUnit for toAbsoluteSeconds in 4/4', () => {
    // 4/4: beatUnit = 1/4; quarter note at 120 BPM = 0.5s (same as no-meter)
    const meter = Meter.create('4/4');
    const seq = Sequence.create([noteEvent('C4', QUARTER, QUARTER)], { tempo: 120, meter });
    const [timed] = seq.toAbsoluteSeconds();
    expect(timed?.startSeconds).toBeCloseTo(0.5);
    expect(timed?.durationSeconds).toBeCloseTo(0.5);
  });

  it('uses meter.beatUnit for toAbsoluteSeconds in 6/8 (compound)', () => {
    // 6/8: beatUnit = 3/8; dotted quarter = 3/8 = one beat at 120 BPM → 0.5s
    const meter = Meter.create('6/8');
    const dottedQuarter = q(3, 8);
    const seq = Sequence.create([noteEvent('C4', dottedQuarter, dottedQuarter)], {
      tempo: 120,
      meter,
    });
    const [timed] = seq.toAbsoluteSeconds();
    // start = 3/8 beat; beatUnit = 3/8 → 1 beat → 0.5s
    expect(timed?.startSeconds).toBeCloseTo(0.5);
    expect(timed?.durationSeconds).toBeCloseTo(0.5);
  });

  it('round-trips a sequence with meter via toJSON/fromJSON', () => {
    const meter = Meter.create('6/8');
    const original = Sequence.create([noteEvent('C4', q(0, 1), q(3, 8))], { tempo: 120, meter });

    const json = original.toJSON();
    const restored = Sequence.fromJSON(json);

    // meter must be a real Meter instance with beatUnit
    expect(restored.meter).not.toBeNull();
    expect(restored.meter).toBeInstanceOf(Meter);
    expect(restored.meter?.numerator).toBe(6);
    expect(restored.meter?.denominator).toBe(8);
    expect(restored.equals(original)).toBe(true);
  });

  it('toAbsoluteSeconds works correctly after fromJSON with meter', () => {
    const meter = Meter.create('6/8');
    const dottedQuarter = q(3, 8);
    const original = Sequence.create([noteEvent('C4', dottedQuarter, dottedQuarter)], {
      tempo: 120,
      meter,
    });

    const restored = Sequence.fromJSON(original.toJSON());
    const [timed] = restored.toAbsoluteSeconds();

    // Should use meter.beatUnit = 3/8; dotted quarter at 120 BPM → 0.5s
    expect(timed?.startSeconds).toBeCloseTo(0.5);
    expect(timed?.durationSeconds).toBeCloseTo(0.5);
  });

  it('preserves meter after transpose', () => {
    const meter = Meter.create('3/4');
    const seq = Sequence.create([noteEvent('C4', q(0, 1), QUARTER)], { tempo: 120, meter });
    const transposed = seq.transpose('majorSecond');

    expect(transposed.meter).not.toBeNull();
    expect(transposed.meter?.numerator).toBe(3);
    expect(transposed.meter?.denominator).toBe(4);
  });

  it('considers two sequences with same meter equal', () => {
    const meter = Meter.create('3/4');
    const a = Sequence.create([], { tempo: 120, meter });
    const b = Sequence.create([], { tempo: 120, meter: Meter.create('3/4') });
    expect(a.equals(b)).toBe(true);
  });

  it('considers two sequences unequal when meters differ', () => {
    const a = Sequence.create([], { tempo: 120, meter: Meter.create('4/4') });
    const b = Sequence.create([], { tempo: 120, meter: Meter.create('3/4') });
    expect(a.equals(b)).toBe(false);
  });

  it('considers sequence with meter unequal to one without', () => {
    const a = Sequence.create([], { tempo: 120, meter: Meter.create('4/4') });
    const b = Sequence.create([], { tempo: 120 });
    expect(a.equals(b)).toBe(false);
  });
});
