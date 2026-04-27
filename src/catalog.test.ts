import { describe, expect, it } from 'bun:test';

import { INTERVALS, resolveInterval } from './intervals.ts';
import { CHORDS, resolveChordSuffix } from './chords.ts';
import { SCALES, resolveScaleType } from './scales.ts';
import { isInterval, isChordSuffix, isScaleType } from './music-utilities.ts';
import {
  ALL_NOTE_NAMES,
  enharmonicsForNoteName,
  noteNameToChromaticIndex,
} from './note-spellings.ts';

// ---------------------------------------------------------------------------
// H6 — Alias ↔ canonical drift tests
// ---------------------------------------------------------------------------

describe('interval catalog', () => {
  const intervalKeys = Object.keys(INTERVALS).filter(isInterval);

  it.each(intervalKeys)('interval "%s" resolves to a key that exists in INTERVALS', (key) => {
    const resolved = resolveInterval(key);
    expect(INTERVALS).toHaveProperty(resolved);
  });

  it.each(intervalKeys)(
    'interval alias "%s" data deep-equals the canonical entry it resolves to',
    (key) => {
      const resolved = resolveInterval(key);
      if (resolved === key) return;
      expect(INTERVALS[key]).toEqual(INTERVALS[resolved]);
    },
  );
});

describe('chord catalog', () => {
  const chordKeys = Object.keys(CHORDS).filter(isChordSuffix);

  it.each(chordKeys)('chord "%s" resolves to a key that exists in CHORDS', (key) => {
    const resolved = resolveChordSuffix(key);
    expect(CHORDS).toHaveProperty(resolved);
  });

  it.each(chordKeys)(
    'chord alias "%s" intervals deep-equal the canonical entry it resolves to',
    (key) => {
      const resolved = resolveChordSuffix(key);
      if (resolved === key) return;
      expect(CHORDS[key].intervals).toEqual(CHORDS[resolved].intervals);
    },
  );
});

describe('scale catalog', () => {
  const scaleKeys = Object.keys(SCALES).filter(isScaleType);

  it.each(scaleKeys)('scale "%s" resolves to a key that exists in SCALES', (key) => {
    const resolved = resolveScaleType(key);
    expect(SCALES).toHaveProperty(resolved);
  });

  it.each(scaleKeys)(
    'scale alias "%s" intervals deep-equal the canonical entry it resolves to',
    (key) => {
      const resolved = resolveScaleType(key);
      if (resolved === key) return;
      expect(SCALES[key].intervals).toEqual(SCALES[resolved].intervals);
    },
  );
});

describe('note enharmonics consistency', () => {
  it.each(ALL_NOTE_NAMES)(
    'every enharmonic of "%s" shares the same chromatic index',
    (noteName) => {
      const index = noteNameToChromaticIndex(noteName);
      const enharmonics = enharmonicsForNoteName(noteName);
      for (const enharmonic of enharmonics) {
        expect(noteNameToChromaticIndex(enharmonic)).toBe(index);
      }
    },
  );
});
