import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';
import { createFrequency, createMidiKey } from './branded-types.js';
import { justIntonationRatiosFor } from './just-intonation.js';
import { midiToFrequency } from './music-utilities.js';
import { Note } from './note.js';
import {
  EQUAL_TEMPERAMENT,
  JUST_INTONATION,
  centsBetween,
  centsOffsetTemperament,
  edo,
  frequencyFor,
  tunedScale,
  type TunedPitch,
} from './temperament.js';

// ---------------------------------------------------------------------------
// EQUAL_TEMPERAMENT constant
// ---------------------------------------------------------------------------

describe('EQUAL_TEMPERAMENT', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(EQUAL_TEMPERAMENT)).toBe(true);
  });

  it('has kind "equal"', () => {
    expect(EQUAL_TEMPERAMENT.kind).toBe('equal');
  });
});

// ---------------------------------------------------------------------------
// JUST_INTONATION constant
// ---------------------------------------------------------------------------

describe('JUST_INTONATION', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(JUST_INTONATION)).toBe(true);
  });

  it('has kind "just"', () => {
    expect(JUST_INTONATION.kind).toBe('just');
  });
});

// ---------------------------------------------------------------------------
// edo()
// ---------------------------------------------------------------------------

describe('edo', () => {
  it('creates a valid EDO temperament', () => {
    const t = edo(24);
    expect(t.kind).toBe('edo');
    expect(t.divisions).toBe(24);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(edo(12))).toBe(true);
  });

  it('throws RangeError for 0 divisions', () => {
    expect(() => edo(0)).toThrow(RangeError);
  });

  it('throws RangeError for negative divisions', () => {
    expect(() => edo(-1)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer divisions', () => {
    expect(() => edo(12.5)).toThrow(RangeError);
  });

  it('EDO(24) step size is 50 cents', () => {
    // Each step = 1200 / 24 = 50 cents
    const stepCents = 1200 / edo(24).divisions;
    expect(stepCents).toBeCloseTo(50, 6);
  });

  it('EDO(19) step size ≈ 63.158 cents', () => {
    const stepCents = 1200 / edo(19).divisions;
    expect(stepCents).toBeCloseTo(63.158, 2);
  });
});

// ---------------------------------------------------------------------------
// centsOffsetTemperament()
// ---------------------------------------------------------------------------

describe('centsOffsetTemperament', () => {
  it('creates a cents-offset temperament', () => {
    const offsets = Array.from({ length: 12 }, () => 0);
    const t = centsOffsetTemperament(offsets);
    expect(t.kind).toBe('cents-offset');
    expect(t.offsets.length).toBe(12);
  });

  it('is frozen', () => {
    const t = centsOffsetTemperament(Array.from({ length: 12 }, () => 0));
    expect(Object.isFrozen(t)).toBe(true);
    expect(Object.isFrozen(t.offsets)).toBe(true);
  });

  it('throws TypeError when offsets length ≠ 12', () => {
    expect(() => centsOffsetTemperament([0, 1, 2])).toThrow(TypeError);
    expect(() => centsOffsetTemperament(Array.from({ length: 13 }, () => 0))).toThrow(TypeError);
  });

  it('throws RangeError when an offset is non-finite', () => {
    const offsets = Array.from({ length: 12 }, () => 0);
    offsets[3] = Infinity;
    expect(() => centsOffsetTemperament(offsets)).toThrow(RangeError);
  });

  it('throws RangeError when an offset is NaN', () => {
    const offsets = Array.from({ length: 12 }, () => 0);
    offsets[5] = NaN;
    expect(() => centsOffsetTemperament(offsets)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// centsBetween
// ---------------------------------------------------------------------------

describe('centsBetween', () => {
  it('returns 1200 for an octave (440 → 880)', () => {
    expect(centsBetween(440, 880)).toBe(1200);
  });

  it('returns 0 when both frequencies are equal', () => {
    expect(centsBetween(440, 440)).toBe(0);
    expect(centsBetween(261.63, 261.63)).toBe(0);
  });

  it('returns negative cents when frequencyB < frequencyA', () => {
    expect(centsBetween(880, 440)).toBeCloseTo(-1200, 10);
  });

  it('throws RangeError for non-positive frequencyA', () => {
    expect(() => centsBetween(0, 440)).toThrow(RangeError);
    expect(() => centsBetween(-1, 440)).toThrow(RangeError);
  });

  it('throws RangeError for non-positive frequencyB', () => {
    expect(() => centsBetween(440, 0)).toThrow(RangeError);
    expect(() => centsBetween(440, -1)).toThrow(RangeError);
  });

  it('throws RangeError for non-finite frequencies', () => {
    expect(() => centsBetween(Infinity, 440)).toThrow(RangeError);
    expect(() => centsBetween(440, NaN)).toThrow(RangeError);
  });

  it('property: centsBetween(a, b) === -centsBetween(b, a)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 20, max: 20000, noNaN: true }),
        fc.float({ min: 20, max: 20000, noNaN: true }),
        (a, b) => {
          expect(centsBetween(a, b)).toBeCloseTo(-centsBetween(b, a), 10);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// frequencyFor — EqualTemperament
// ---------------------------------------------------------------------------

describe('frequencyFor (EqualTemperament)', () => {
  it('frequencyFor(A4) === 440 Hz exactly under standard tuning', () => {
    const a4 = Note.create('A4');
    const freq = frequencyFor(a4);
    expect(Number(freq)).toBe(440);
  });

  it('equals midiToFrequency for every MIDI note 0..127', () => {
    for (let midi = 0; midi <= 127; midi += 1) {
      const note = Note.fromMidi(midi);
      const expected = Number(midiToFrequency(createMidiKey(midi)));
      const actual = Number(frequencyFor(note, { temperament: EQUAL_TEMPERAMENT }));
      // Bit-exact equality: they should be identical floating-point values.
      expect(actual).toBe(expected);
    }
  });

  it('defaults to EQUAL_TEMPERAMENT when no temperament is specified', () => {
    const c4 = Note.create('C4');
    const withDefault = Number(frequencyFor(c4));
    const withExplicit = Number(frequencyFor(c4, { temperament: EQUAL_TEMPERAMENT }));
    expect(withDefault).toBe(withExplicit);
  });

  it('respects a custom referenceTuning (A4 = 432 Hz)', () => {
    const tuning432 = { reference: 'A4' as const, frequency: createFrequency(432) };
    const a4 = Note.create('A4');
    expect(Number(frequencyFor(a4, { referenceTuning: tuning432 }))).toBeCloseTo(432, 6);
  });
});

// ---------------------------------------------------------------------------
// frequencyFor — EDO
// ---------------------------------------------------------------------------

describe('frequencyFor (EDO)', () => {
  it('EDO(12) reproduces midiToFrequency bit-exactly for every MIDI note', () => {
    const edo12 = edo(12);
    for (let midi = 0; midi <= 127; midi += 1) {
      const note = Note.fromMidi(midi);
      const expected = Number(midiToFrequency(createMidiKey(midi)));
      const actual = Number(frequencyFor(note, { temperament: edo12 }));
      expect(actual).toBe(expected);
    }
  });

  it('EDO(24) step from A4 is 50 cents above A4 frequency', () => {
    const a4 = Note.create('A4'); // MIDI 69
    const edo24 = edo(24);
    const freqA4 = Number(frequencyFor(a4, { temperament: edo24 }));
    // One EDO-24 step up = MIDI 70 under EDO(24)
    const bFlat4 = Note.fromMidi(70);
    const freqStep = Number(frequencyFor(bFlat4, { temperament: edo24 }));
    const cents = centsBetween(freqA4, freqStep);
    expect(cents).toBeCloseTo(50, 5);
  });

  it('EDO(19) step ≈ 63.158 cents', () => {
    const a4 = Note.create('A4');
    const edo19 = edo(19);
    const freqA4 = Number(frequencyFor(a4, { temperament: edo19 }));
    const nextNote = Note.fromMidi(70);
    const freqNext = Number(frequencyFor(nextNote, { temperament: edo19 }));
    const cents = centsBetween(freqA4, freqNext);
    expect(cents).toBeCloseTo(1200 / 19, 3);
  });

  it('EDO(n) always places A4 at the reference frequency', () => {
    const a4 = Note.create('A4');
    for (const n of [5, 12, 17, 19, 24, 31, 53]) {
      const freq = Number(frequencyFor(a4, { temperament: edo(n) }));
      expect(freq).toBeCloseTo(440, 6);
    }
  });
});

// ---------------------------------------------------------------------------
// frequencyFor — CentsOffset
// ---------------------------------------------------------------------------

describe('frequencyFor (CentsOffsetTemperament)', () => {
  it('all-zero offsets equals ET', () => {
    const zeroOffsets = centsOffsetTemperament(Array.from({ length: 12 }, () => 0));
    for (let midi = 0; midi <= 127; midi += 1) {
      const note = Note.fromMidi(midi);
      const et = Number(midiToFrequency(createMidiKey(midi)));
      const actual = Number(frequencyFor(note, { temperament: zeroOffsets }));
      expect(actual).toBeCloseTo(et, 8);
    }
  });

  it('+1200 cents offset doubles the frequency for that pitch class', () => {
    // Offset every pitch class by +1200 cents → every note should be doubled
    const offsets = centsOffsetTemperament(Array.from({ length: 12 }, () => 1200));
    const c4 = Note.create('C4');
    const et = Number(midiToFrequency(createMidiKey(Number(c4.midi))));
    const adjusted = Number(frequencyFor(c4, { temperament: offsets }));
    expect(adjusted).toBeCloseTo(et * 2, 6);
  });

  it('offset applies only to the targeted pitch class', () => {
    // Offset pitch class 0 (C) by +100 cents, all others zero
    const offsetArray = Array.from({ length: 12 }, () => 0);
    offsetArray[0] = 100;
    const t = centsOffsetTemperament(offsetArray);

    const c4 = Note.create('C4'); // pitch class 0
    const d4 = Note.create('D4'); // pitch class 2

    const etC = Number(midiToFrequency(createMidiKey(Number(c4.midi))));
    const etD = Number(midiToFrequency(createMidiKey(Number(d4.midi))));

    const adjC = Number(frequencyFor(c4, { temperament: t }));
    const adjD = Number(frequencyFor(d4, { temperament: t }));

    // C should be raised by 100 cents (one semitone ≈ factor of 2^(1/12))
    expect(centsBetween(etC, adjC)).toBeCloseTo(100, 4);
    // D should be unchanged
    expect(adjD).toBeCloseTo(etD, 8);
  });
});

// ---------------------------------------------------------------------------
// frequencyFor — JustIntonation
// ---------------------------------------------------------------------------

describe('frequencyFor (JustIntonation)', () => {
  it('throws TypeError when keyOrTonic is missing', () => {
    const a4 = Note.create('A4');
    expect(() => frequencyFor(a4, { temperament: JUST_INTONATION })).toThrow(TypeError);
  });

  it('tonic equals its own ET frequency (ratio 1/1)', () => {
    const c4 = Note.create('C4');
    const justFreq = Number(
      frequencyFor(c4, {
        temperament: JUST_INTONATION,
        keyOrTonic: c4,
      }),
    );
    const etFreq = Number(midiToFrequency(c4.midi));
    // tonic ratio is 1/1, so JI frequency equals the ET reference frequency
    expect(justFreq).toBeCloseTo(etFreq, 6);
  });

  it('just major third is ≈ -13.686 cents from ET major third', () => {
    // In C major, the major third is E4 (MIDI 64)
    const c4 = Note.create('C4');
    const e4 = Note.create('E4');

    const justE4 = Number(
      frequencyFor(e4, {
        temperament: JUST_INTONATION,
        keyOrTonic: c4,
      }),
    );
    const etE4 = Number(midiToFrequency(e4.midi));

    // Just M3 (5/4 = 386.314 cents) is ~13.686 cents FLAT of ET M3 (400 cents)
    const diff = centsBetween(etE4, justE4);
    expect(diff).toBeCloseTo(-13.686, 1);
  });

  it('just perfect fifth is ≈ +1.955 cents from ET perfect fifth', () => {
    // In C major, the perfect fifth is G4 (MIDI 67)
    const c4 = Note.create('C4');
    const g4 = Note.create('G4');

    const justG4 = Number(
      frequencyFor(g4, {
        temperament: JUST_INTONATION,
        keyOrTonic: c4,
      }),
    );
    const etG4 = Number(midiToFrequency(g4.midi));

    // Just P5 (3/2 = 701.955 cents) is ~1.955 cents SHARP of ET P5 (700 cents)
    const diff = centsBetween(etG4, justG4);
    expect(diff).toBeCloseTo(1.955, 1);
  });

  it('just major second (9/8) is ≈ +3.910 cents from ET major second', () => {
    const c4 = Note.create('C4');
    const d4 = Note.create('D4'); // semitone 2

    const justD4 = Number(
      frequencyFor(d4, {
        temperament: JUST_INTONATION,
        keyOrTonic: c4,
      }),
    );
    const etD4 = Number(midiToFrequency(d4.midi));

    // JI M2 (9/8 = 203.910 cents) vs ET M2 (200 cents) → +3.910 cents
    const diff = centsBetween(etD4, justD4);
    expect(diff).toBeCloseTo(3.91, 1);
  });

  it('works an octave above the tonic', () => {
    const c4 = Note.create('C4');
    const c5 = Note.create('C5');

    const justC5 = Number(
      frequencyFor(c5, {
        temperament: JUST_INTONATION,
        keyOrTonic: c4,
      }),
    );
    const etC4 = Number(midiToFrequency(c4.midi));

    // C5 is one octave above tonic: ratio 2/1
    expect(justC5).toBeCloseTo(etC4 * 2, 6);
  });

  it('works an octave below the tonic (descending)', () => {
    const c4 = Note.create('C4');
    const g3 = Note.create('G3'); // P5 below tonic

    const justG3 = Number(
      frequencyFor(g3, {
        temperament: JUST_INTONATION,
        keyOrTonic: c4,
      }),
    );
    const etC4 = Number(midiToFrequency(c4.midi));

    // G3 is a perfect fifth below C4: ratio 3/2 in the octave below
    // tonic(C4) * (3/2) / 2 = etC4 * 3/4
    expect(justG3).toBeCloseTo(etC4 * (3 / 4), 6);
  });

  it('throws TypeError for a chromatic semitone not in the major scale', () => {
    const c4 = Note.create('C4');
    const cSharp4 = Note.create('C#4'); // semitone 1 — not in major

    expect(() =>
      frequencyFor(cSharp4, {
        temperament: JUST_INTONATION,
        keyOrTonic: c4,
      }),
    ).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// tunedScale
// ---------------------------------------------------------------------------

describe('tunedScale', () => {
  it('returns an empty array for empty input', () => {
    const result = tunedScale([], EQUAL_TEMPERAMENT);
    expect(result.length).toBe(0);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('returns TunedPitch objects for each note', () => {
    const c4 = Note.create('C4');
    const e4 = Note.create('E4');
    const g4 = Note.create('G4');
    const result = tunedScale([c4, e4, g4], EQUAL_TEMPERAMENT);
    expect(result.length).toBe(3);
  });

  it('TunedPitch contains note, frequency, and centsDeviation', () => {
    const c4 = Note.create('C4');
    const result = tunedScale([c4], EQUAL_TEMPERAMENT);
    const tuned = result[0];
    expect(tuned.note).toBeInstanceOf(Note);
    expect(typeof Number(tuned.frequency)).toBe('number');
    expect(typeof tuned.centsDeviation).toBe('number');
  });

  it('ET temperament has 0 cents deviation for all notes', () => {
    const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'].map((n) => Note.create(n));
    const result = tunedScale(notes, EQUAL_TEMPERAMENT);
    for (const tuned of result) {
      expect(tuned.centsDeviation).toBeCloseTo(0, 8);
    }
  });

  it('JI major third has ≈ -13.686 cents deviation from ET', () => {
    const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'].map((n) => Note.create(n));
    const result = tunedScale(notes, JUST_INTONATION);
    // E4 is index 2 (scale degree 3, M3 from C)
    const e4Tuned = result[2];
    expect(e4Tuned.centsDeviation).toBeCloseTo(-13.686, 1);
  });

  it('JI perfect fifth has ≈ +1.955 cents deviation from ET', () => {
    const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'].map((n) => Note.create(n));
    const result = tunedScale(notes, JUST_INTONATION);
    // G4 is index 4 (scale degree 5, P5 from C)
    const g4Tuned = result[4];
    expect(g4Tuned.centsDeviation).toBeCloseTo(1.955, 1);
  });

  it('returns a frozen outer array', () => {
    const result = tunedScale([Note.create('C4')], EQUAL_TEMPERAMENT);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('each TunedPitch is frozen', () => {
    const result = tunedScale([Note.create('C4')], EQUAL_TEMPERAMENT);
    expect(Object.isFrozen(result[0])).toBe(true);
  });

  it('respects a custom referenceTuning', () => {
    const tuning432 = { reference: 'A4' as const, frequency: createFrequency(432) };
    const a4 = Note.create('A4');
    const result = tunedScale([a4], EQUAL_TEMPERAMENT, { referenceTuning: tuning432 });
    expect(Number(result[0].frequency)).toBeCloseTo(432, 6);
  });

  it('JI throws TypeError when a note is not a major-scale degree relative to the tonic', () => {
    // notes[0] = C4 (tonic), notes[1] = Eb4 (minor third — semitone 3, not in major)
    const notes = [Note.create('C4'), Note.create('Eb4')];
    expect(() => tunedScale(notes, JUST_INTONATION)).toThrow(TypeError);
  });

  it('JI uses an explicit keyOrTonic instead of notes[0] when provided', () => {
    // E4 and G4 with default tonic (E4) would make G4 semitone 3 → throws.
    // With explicit C4 tonic: E4 = M3 (semitone 4) and G4 = P5 (semitone 7) — both valid.
    const notes = [Note.create('E4'), Note.create('G4')];
    const result = tunedScale(notes, JUST_INTONATION, { keyOrTonic: Note.create('C4') });
    expect(result.length).toBe(2);
    // E4 as M3 from C4 should have ≈ -13.686 cents deviation
    expect(result[0].centsDeviation).toBeCloseTo(-13.686, 1);
    // G4 as P5 from C4 should have ≈ +1.955 cents deviation
    expect(result[1].centsDeviation).toBeCloseTo(1.955, 1);
  });
});

// ---------------------------------------------------------------------------
// Re-exports from just-intonation.ts
// ---------------------------------------------------------------------------

describe('justIntonationRatiosFor (imported from just-intonation)', () => {
  it('returns [1/1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8] for major scale', () => {
    const ratios = justIntonationRatiosFor('major');
    expect(ratios.length).toBe(7);
    expect(ratios[0].numerator).toBe(1);
    expect(ratios[0].denominator).toBe(1);
    expect(ratios[6].numerator).toBe(15);
    expect(ratios[6].denominator).toBe(8);
  });
});
