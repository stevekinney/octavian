import { describe, it, expect } from 'bun:test';
import { evaluatePitchEstimate } from './index.js';
import { Note } from '../note.js';
import { createFrequency } from '../branded-types.js';
import type { Tuning } from '../tuning.js';

// ---------------------------------------------------------------------------
// Tuning fixture for alternate-tuning tests (A4 = 432 Hz)
// ---------------------------------------------------------------------------

const TUNING_432: Tuning = {
  reference: 'A4',
  frequency: createFrequency(432),
};

// ---------------------------------------------------------------------------
// Exact equal-tempered frequencies (verified externally)
// ---------------------------------------------------------------------------

// A4 = 440 Hz
const A4_FREQ = 440;
// A#4 = 466.1637615180899 Hz
const AS4_FREQ = 466.1637615180899;
// A5 = 880 Hz
const A5_FREQ = 880;
// G#4 = 415.3046975799451 Hz
const GS4_FREQ = 415.3046975799451;

describe('evaluatePitchEstimate', () => {
  describe('A4 target at standard tuning (440 Hz)', () => {
    it('returns 0 centsError when estimate equals target frequency exactly', () => {
      const result = evaluatePitchEstimate({ frequency: A4_FREQ }, { note: 'A', octave: 4 });

      expect(result.centsError).toBeCloseTo(0, 6);
      expect(result.nearestNote.note).toBe('A');
      expect(result.nearestNote.octave).toBe(4);
      expect(result.pitchClassMatches).toBe(true);
      expect(result.registerMatches).toBe(true);
      expect(result.likelyOctaveError).toBe(false);
      expect(result.withinTolerance).toBe(true);
    });

    it('returns ~+100 cents when estimate is A#4 (sharp)', () => {
      const result = evaluatePitchEstimate({ frequency: AS4_FREQ }, { note: 'A', octave: 4 });

      // ~100 cents sharp
      expect(result.centsError).toBeCloseTo(100, 1);
      // Nearest note is A#4, not A4
      expect(result.nearestNote.note).toBe('A#');
      expect(result.nearestNote.octave).toBe(4);
      expect(result.pitchClassMatches).toBe(false);
      expect(result.registerMatches).toBe(false);
      expect(result.likelyOctaveError).toBe(false);
      expect(result.withinTolerance).toBe(false);
    });

    it('returns ~-100 cents when estimate is G#4 (flat)', () => {
      const result = evaluatePitchEstimate({ frequency: GS4_FREQ }, { note: 'A', octave: 4 });

      // ~-100 cents flat
      expect(result.centsError).toBeCloseTo(-100, 1);
      expect(result.nearestNote.note).toBe('G#');
      expect(result.nearestNote.octave).toBe(4);
      expect(result.pitchClassMatches).toBe(false);
      expect(result.registerMatches).toBe(false);
      expect(result.likelyOctaveError).toBe(false);
      expect(result.withinTolerance).toBe(false);
    });

    it('detects likelyOctaveError when estimate is A5 (880 Hz)', () => {
      const result = evaluatePitchEstimate({ frequency: A5_FREQ }, { note: 'A', octave: 4 });

      // +1200 cents (one octave sharp)
      expect(result.centsError).toBeCloseTo(1200, 1);
      expect(result.nearestNote.note).toBe('A');
      expect(result.nearestNote.octave).toBe(5);
      expect(result.pitchClassMatches).toBe(true);
      expect(result.registerMatches).toBe(false);
      expect(result.likelyOctaveError).toBe(true);
      expect(result.withinTolerance).toBe(false);
    });

    it('handles near-boundary estimate of ~453 Hz (~+50.4 cents above A4)', () => {
      const result = evaluatePitchEstimate({ frequency: 453 }, { note: 'A', octave: 4 });

      // 50.4 cents above A4; nearest note is A#4 (not A4)
      expect(result.centsError).toBeCloseTo(50.4, 1);
      expect(result.nearestNote.note).toBe('A#');
      expect(result.nearestNote.octave).toBe(4);
      expect(result.pitchClassMatches).toBe(false);
      expect(result.registerMatches).toBe(false);
      expect(result.likelyOctaveError).toBe(false);
      // 50.4 > 50, so just outside default tolerance
      expect(result.withinTolerance).toBe(false);
    });

    it('is within tolerance when estimate is within 50 cents (sharp)', () => {
      // 20 cents sharp: 440 * 2^(20/1200)
      const sharpBy20 = A4_FREQ * Math.pow(2, 20 / 1200);
      const result = evaluatePitchEstimate({ frequency: sharpBy20 }, { note: 'A', octave: 4 });

      expect(result.centsError).toBeCloseTo(20, 1);
      expect(result.withinTolerance).toBe(true);
    });

    it('respects custom centsTolerance', () => {
      // 30 cents sharp — within tolerance=50, outside tolerance=25
      const sharpBy30 = A4_FREQ * Math.pow(2, 30 / 1200);
      const tight = evaluatePitchEstimate(
        { frequency: sharpBy30 },
        { note: 'A', octave: 4 },
        { centsTolerance: 25 },
      );
      const loose = evaluatePitchEstimate(
        { frequency: sharpBy30 },
        { note: 'A', octave: 4 },
        { centsTolerance: 50 },
      );

      expect(tight.withinTolerance).toBe(false);
      expect(loose.withinTolerance).toBe(true);
    });
  });

  describe('alternate tuning: A4 = 432 Hz', () => {
    it('returns 0 centsError when estimate equals 432 under 432 tuning', () => {
      const result = evaluatePitchEstimate(
        { frequency: 432 },
        { note: 'A', octave: 4 },
        { tuning: TUNING_432 },
      );

      expect(result.centsError).toBeCloseTo(0, 6);
      expect(result.nearestNote.note).toBe('A');
      expect(result.nearestNote.octave).toBe(4);
      expect(result.withinTolerance).toBe(true);
    });

    it('shows positive cents error when 440 is given but target is A4 at 432 tuning', () => {
      // Under 432 tuning, A4 target frequency is 432 Hz — estimate 440 is sharp
      const result = evaluatePitchEstimate(
        { frequency: 440 },
        { note: 'A', octave: 4 },
        { tuning: TUNING_432 },
      );

      // 440 / 432 = ~31.8 cents sharp
      const expectedCents = 1200 * Math.log2(440 / 432);

      expect(result.centsError).toBeCloseTo(expectedCents, 4);
      expect(result.centsError).toBeGreaterThan(0);
    });
  });

  describe('pitchClassOnly mode', () => {
    it('withinTolerance is true for exact pitch match regardless of octave', () => {
      // A5 = 880 Hz with target A4 — octave error, but pitch class matches
      // Folded centsError of 1200 => 0 cents in pitch-class space
      const result = evaluatePitchEstimate(
        { frequency: A5_FREQ },
        { note: 'A', octave: 4 },
        { pitchClassOnly: true },
      );

      expect(result.likelyOctaveError).toBe(true);
      expect(result.withinTolerance).toBe(true);
    });

    it('withinTolerance is false for A#4 estimate vs A4 target with default tolerance', () => {
      // +100 cents folds to 100; |100| > 50
      const result = evaluatePitchEstimate(
        { frequency: AS4_FREQ },
        { note: 'A', octave: 4 },
        { pitchClassOnly: true },
      );

      expect(result.withinTolerance).toBe(false);
    });

    it('withinTolerance is true for A#4 estimate vs A4 target with tolerance=100', () => {
      // +100 cents folds to 100; |100| <= 100
      const result = evaluatePitchEstimate(
        { frequency: AS4_FREQ },
        { note: 'A', octave: 4 },
        { pitchClassOnly: true, centsTolerance: 100 },
      );

      expect(result.withinTolerance).toBe(true);
    });

    it('uses folded cents for a flat estimate in pitch-class-only mode', () => {
      // G#4 = -100 cents from A4; folded -100 is still -100; |-100| > 50
      const result = evaluatePitchEstimate(
        { frequency: GS4_FREQ },
        { note: 'A', octave: 4 },
        { pitchClassOnly: true },
      );

      expect(result.withinTolerance).toBe(false);
    });

    it('withinTolerance is true for small deviation in pitchClassOnly mode', () => {
      // 20 cents sharp — |20| <= 50
      const sharpBy20 = A4_FREQ * Math.pow(2, 20 / 1200);
      const result = evaluatePitchEstimate(
        { frequency: sharpBy20 },
        { note: 'A', octave: 4 },
        { pitchClassOnly: true },
      );

      expect(result.withinTolerance).toBe(true);
    });
  });

  describe('default options', () => {
    it('defaults to 50-cent tolerance (boundary at exactly 50 cents)', () => {
      // 50 cents sharp from A4 is exactly the semitone midpoint; it rounds to
      // A#4, so registerMatches is false and withinTolerance is false.
      // In pitchClassOnly mode, 50 cents folds to 50, and |50| <= 50 is true.
      const sharpBy50 = A4_FREQ * Math.pow(2, 50 / 1200);

      const registerResult = evaluatePitchEstimate(
        { frequency: sharpBy50 },
        { note: 'A', octave: 4 },
      );
      const pitchClassResult = evaluatePitchEstimate(
        { frequency: sharpBy50 },
        { note: 'A', octave: 4 },
        { pitchClassOnly: true },
      );

      // nearestNote rounds to A#4 at the midpoint
      expect(registerResult.nearestNote.note).toBe('A#');
      expect(registerResult.withinTolerance).toBe(false);
      // pitchClassOnly: folded 50 cents <= 50 is true
      expect(pitchClassResult.withinTolerance).toBe(true);
    });

    it('defaults to register mode (not pitchClassOnly)', () => {
      // A5 vs A4: likelyOctaveError but NOT withinTolerance in register mode
      const result = evaluatePitchEstimate({ frequency: A5_FREQ }, { note: 'A', octave: 4 });

      expect(result.likelyOctaveError).toBe(true);
      expect(result.withinTolerance).toBe(false);
    });
  });

  describe('target note spelled different ways', () => {
    it('accepts note name string', () => {
      // 'A' defaults to octave 4 — pitchClass matches for A4 target
      const result = evaluatePitchEstimate({ frequency: A4_FREQ }, 'A');

      expect(result.pitchClassMatches).toBe(true);
    });

    it('accepts object with note and octave', () => {
      const result = evaluatePitchEstimate({ frequency: A4_FREQ }, { note: 'A', octave: 4 });

      expect(result.registerMatches).toBe(true);
    });

    it('accepts Note instance as target', () => {
      const target = Note.create({ note: 'A', octave: 4 });
      const result = evaluatePitchEstimate({ frequency: A4_FREQ }, target);

      expect(result.registerMatches).toBe(true);
    });
  });

  describe('error propagation', () => {
    it('throws RangeError for zero frequency', () => {
      expect(() => evaluatePitchEstimate({ frequency: 0 }, { note: 'A', octave: 4 })).toThrow(
        RangeError,
      );
    });

    it('throws RangeError for negative frequency', () => {
      expect(() => evaluatePitchEstimate({ frequency: -440 }, { note: 'A', octave: 4 })).toThrow(
        RangeError,
      );
    });

    it('throws RangeError for non-finite frequency', () => {
      expect(() =>
        evaluatePitchEstimate({ frequency: Number.POSITIVE_INFINITY }, { note: 'A', octave: 4 }),
      ).toThrow(RangeError);
    });

    it('throws TypeError for invalid target note', () => {
      expect(() =>
        evaluatePitchEstimate({ frequency: A4_FREQ }, 'NotAValidNoteName' as never),
      ).toThrow(TypeError);
    });

    it('throws RangeError for negative centsTolerance', () => {
      expect(() =>
        evaluatePitchEstimate(
          { frequency: A4_FREQ },
          { note: 'A', octave: 4 },
          { centsTolerance: -1 },
        ),
      ).toThrow(RangeError);
    });

    it('throws RangeError for NaN centsTolerance', () => {
      expect(() =>
        evaluatePitchEstimate(
          { frequency: A4_FREQ },
          { note: 'A', octave: 4 },
          { centsTolerance: NaN },
        ),
      ).toThrow(RangeError);
    });

    it('throws RangeError for Infinity centsTolerance', () => {
      expect(() =>
        evaluatePitchEstimate(
          { frequency: A4_FREQ },
          { note: 'A', octave: 4 },
          { centsTolerance: Infinity },
        ),
      ).toThrow(RangeError);
    });
  });
});
