import { describe, expect, it } from 'bun:test';

import {
  ACCIDENTALS,
  ACCIDENTAL_OFFSETS,
  ALL_NOTE_NAMES,
  accidentalFromNoteName,
  buildNoteName,
  enharmonicsForNoteName,
  noteNameToChromaticIndex,
  simplifyNoteName,
} from './note-spellings.js';

describe('triple accidentals — catalog and operations', () => {
  it('ACCIDENTALS includes ### and bbb', () => {
    expect(ACCIDENTALS).toContain('###');
    expect(ACCIDENTALS).toContain('bbb');
    expect(ACCIDENTALS).toHaveLength(7);
  });

  it('ACCIDENTAL_OFFSETS maps ### to +3 and bbb to -3', () => {
    expect(ACCIDENTAL_OFFSETS['###']).toBe(3);
    expect(ACCIDENTAL_OFFSETS['bbb']).toBe(-3);
  });

  it('ALL_NOTE_NAMES has 49 entries (7 naturals × 7 accidentals)', () => {
    expect(ALL_NOTE_NAMES).toHaveLength(49);
    expect(ALL_NOTE_NAMES).toContain('C###');
    expect(ALL_NOTE_NAMES).toContain('Bbbb');
    expect(ALL_NOTE_NAMES).toContain('F###');
    expect(ALL_NOTE_NAMES).toContain('Cbbb');
  });

  it('accidentalFromNoteName detects triples ahead of doubles', () => {
    expect(accidentalFromNoteName('C###')).toBe('###');
    expect(accidentalFromNoteName('Bbbb')).toBe('bbb');
    // Make sure doubles still detect:
    expect(accidentalFromNoteName('F##')).toBe('##');
    expect(accidentalFromNoteName('Bbb')).toBe('bb');
  });

  it('buildNoteName supports +3 and -3 offsets', () => {
    expect(buildNoteName('C', 3)).toBe('C###');
    expect(buildNoteName('B', -3)).toBe('Bbbb');
    expect(buildNoteName('F', 3)).toBe('F###');
  });

  it('buildNoteName still rejects offsets beyond ±3', () => {
    expect(() => buildNoteName('C', 4)).toThrow(RangeError);
    expect(() => buildNoteName('C', -4)).toThrow(RangeError);
  });

  it('noteNameToChromaticIndex round-trips through triple accidentals', () => {
    // C### = C(0) + 3 = pitch class 3 (D#)
    expect(noteNameToChromaticIndex('C###')).toBe(3);
    // Bbbb = B(11) - 3 = pitch class 8 (G#)
    expect(noteNameToChromaticIndex('Bbbb')).toBe(8);
    // F### = F(5) + 3 = pitch class 8 (G#)
    expect(noteNameToChromaticIndex('F###')).toBe(8);
  });

  it('enharmonicsForNoteName returns triple-accidental forms when relevant', () => {
    // D# = 3 = C### (triple-sharp form of C)
    const dSharpEnharmonics = enharmonicsForNoteName('D#');
    expect(dSharpEnharmonics).toContain('C###');
    // G# = 8 = both Bbbb and F### are triple-accidental enharmonics
    const gSharpEnharmonics = enharmonicsForNoteName('G#');
    expect(gSharpEnharmonics).toContain('Bbbb');
    expect(gSharpEnharmonics).toContain('F###');
  });

  it('simplifyNoteName reduces triple accidentals to common forms', () => {
    // F### = pc (5+3) = 8 = G# under sharp preference.
    expect(simplifyNoteName('F###')).toBe('G#');
    // Bbbb = pc (11-3) = 8 = G#.
    expect(simplifyNoteName('Bbbb')).toBe('G#');
    // C### = pc 3 = D#.
    expect(simplifyNoteName('C###')).toBe('D#');
    // Cbbb = pc (0-3+12) = 9 = A.
    expect(simplifyNoteName('Cbbb')).toBe('A');
  });

  it('every triple-accidental note name has a chromatic index in 0–11', () => {
    const tripleAccidentalNames = ALL_NOTE_NAMES.filter(
      (name) => name.endsWith('###') || name.endsWith('bbb'),
    );
    expect(tripleAccidentalNames).toHaveLength(14); // 7 naturals × 2 triple accidentals
    for (const name of tripleAccidentalNames) {
      const index = noteNameToChromaticIndex(name);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(11);
    }
  });
});
