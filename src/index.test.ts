import { describe, expect, it } from 'bun:test';

import {
  CHORDS,
  INTERVALS,
  Note,
  SCALES,
  Scale,
  STANDARD_TUNING,
  applyInterval,
  isChordSuffix,
  isNoteName,
  isScaleType,
} from './index.ts';

describe('index exports', () => {
  it('re-exports the public music theory API', () => {
    expect(new Note('C', 4).toString()).toBe('C4');
    expect(new Scale('C4', 'major').toString()).toBe('C major');
    expect(applyInterval(new Note('C', 4), 'perfectFifth').toString()).toBe('G4');
    expect(INTERVALS.majorThird.symbol).toBe('M3');
    expect(CHORDS.majorSeventh.symbol).toBe('maj7');
    expect(SCALES.major.intervals).toContain('majorThird');
    expect(STANDARD_TUNING.frequency).toBe(440);
    expect(isNoteName('C#')).toBe(true);
    expect(isChordSuffix('maj7')).toBe(true);
    expect(isScaleType('mixolydian')).toBe(true);
  });

  it('still loads the Bun test preload', () => {
    expect((globalThis as Record<string, unknown>).__BUN_TEST_SETUP_LOADED__).toBe(true);
  });
});
