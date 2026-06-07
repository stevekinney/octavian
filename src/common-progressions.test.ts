import { describe, expect, it } from 'bun:test';

import { Key } from './key.js';
import {
  commonProgressionName,
  commonProgressions,
  findCommonProgression,
} from './common-progressions.js';
import { Progression } from './progression.js';

describe('commonProgressions', () => {
  it('returns a non-empty array of Progression instances', () => {
    const all = commonProgressions();
    expect(all.length).toBeGreaterThan(0);
    for (const prog of all) {
      expect(Progression.isProgression(prog)).toBe(true);
    }
  });

  it('returns the same reference on repeated calls (frozen)', () => {
    const a = commonProgressions();
    const b = commonProgressions();
    expect(a).toBe(b);
  });

  it('contains a ii–V–I pattern', () => {
    const all = commonProgressions();
    const iiVI = all.find((p) => {
      const nums = p.numerals;
      return (
        nums.length >= 3 && nums[0]!.degree === 2 && nums[1]!.degree === 5 && nums[2]!.degree === 1
      );
    });
    expect(iiVI).toBeDefined();
  });

  it('contains an I–vi–IV–V (50s) pattern', () => {
    const all = commonProgressions();
    const fifties = all.find((p) => {
      const nums = p.numerals;
      return (
        nums.length >= 4 &&
        nums[0]!.degree === 1 &&
        nums[1]!.degree === 6 &&
        nums[2]!.degree === 4 &&
        nums[3]!.degree === 5
      );
    });
    expect(fifties).toBeDefined();
  });

  it('contains an I–vi–ii–V (jazz turnaround) pattern', () => {
    const all = commonProgressions();
    const turnaround = all.find((p) => {
      const nums = p.numerals;
      return (
        nums.length >= 4 &&
        nums[0]!.degree === 1 &&
        nums[1]!.degree === 6 &&
        nums[2]!.degree === 2 &&
        nums[3]!.degree === 5
      );
    });
    expect(turnaround).toBeDefined();
  });

  it('contains a 12-bar blues pattern with 12 entries', () => {
    const all = commonProgressions();
    const blues = all.find((p) => p.length === 12);
    expect(blues).toBeDefined();
    // 12-bar: I I I I IV IV I I V IV I V
    const nums = blues!.numerals;
    expect(nums[0]!.degree).toBe(1); // I
    expect(nums[4]!.degree).toBe(4); // IV
    expect(nums[8]!.degree).toBe(5); // V
    expect(nums[9]!.degree).toBe(4); // IV
  });

  it('12-bar blues materializes to correct roots in C major', () => {
    const all = commonProgressions();
    const blues = all.find((p) => p.length === 12)!;
    const key = Key.create('C', 'major');
    const resolved = blues.in(key);
    expect(resolved.chords[0]!.root.note).toBe('C'); // I = C
    expect(resolved.chords[4]!.root.note).toBe('F'); // IV = F
    expect(resolved.chords[8]!.root.note).toBe('G'); // V = G
  });

  it('ii–V–I materializes to Dm, G, C in C major', () => {
    const all = commonProgressions();
    const iiVI = all.find((p) => {
      const nums = p.numerals;
      return (
        nums.length === 3 && nums[0]!.degree === 2 && nums[1]!.degree === 5 && nums[2]!.degree === 1
      );
    })!;
    const key = Key.create('C', 'major');
    const resolved = iiVI.in(key);
    expect(resolved.chords[0]!.root.note).toBe('D');
    expect(resolved.chords[1]!.root.note).toBe('G');
    expect(resolved.chords[2]!.root.note).toBe('C');
  });

  it('jazz turnaround (I–vi–ii–V) materializes correctly in C major', () => {
    const all = commonProgressions();
    const turnaround = all.find((p) => {
      const nums = p.numerals;
      return (
        nums.length >= 4 &&
        nums[0]!.degree === 1 &&
        nums[1]!.degree === 6 &&
        nums[2]!.degree === 2 &&
        nums[3]!.degree === 5
      );
    })!;
    const key = Key.create('C', 'major');
    const resolved = turnaround.in(key);
    expect(resolved.chords[0]!.root.note).toBe('C'); // I
    expect(resolved.chords[1]!.root.note).toBe('A'); // vi
    expect(resolved.chords[2]!.root.note).toBe('D'); // ii
    expect(resolved.chords[3]!.root.note).toBe('G'); // V
  });
});

// ---------------------------------------------------------------------------
// findCommonProgression
// ---------------------------------------------------------------------------

describe('findCommonProgression', () => {
  it('finds a progression by name substring (case-insensitive)', () => {
    const iiVI = findCommonProgression('ii–V–I');
    expect(iiVI).toBeDefined();
    expect(Progression.isProgression(iiVI!)).toBe(true);
  });

  it('returns undefined for an unknown name', () => {
    expect(findCommonProgression('nonsense progression xyz')).toBeUndefined();
  });

  it('is case-insensitive', () => {
    const turnaround = findCommonProgression('JAZZ TURNAROUND');
    expect(turnaround).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// commonProgressionName
// ---------------------------------------------------------------------------

describe('commonProgressionName', () => {
  it('returns the name for index 0', () => {
    const name = commonProgressionName(0);
    expect(typeof name).toBe('string');
    expect((name as string).length).toBeGreaterThan(0);
  });

  it('returns undefined for out-of-range index', () => {
    expect(commonProgressionName(-1)).toBeUndefined();
    expect(commonProgressionName(9999)).toBeUndefined();
  });
});
