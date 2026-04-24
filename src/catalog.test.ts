import { describe, expect, it } from 'bun:test';

import { INTERVALS, resolveInterval } from './intervals.ts';
import { CHORDS, resolveChordSuffix } from './chords.ts';
import { SCALES, resolveScaleType } from './scales.ts';
import {
  ALL_NOTE_NAMES,
  enharmonicsForNoteName,
  noteNameToChromaticIndex,
} from './note-spellings.ts';

// ---------------------------------------------------------------------------
// H6 — Alias ↔ canonical drift tests
// ---------------------------------------------------------------------------

describe('interval catalog', () => {
  const intervalEntries = Object.entries(INTERVALS);

  it.each(intervalEntries)('interval "%s" resolves to a key that exists in INTERVALS', (key) => {
    const resolved = resolveInterval(key as keyof typeof INTERVALS);
    expect(INTERVALS).toHaveProperty(resolved);
  });

  it.each(intervalEntries)(
    'interval alias "%s" data deep-equals the canonical entry it resolves to',
    (key) => {
      const typedKey = key as keyof typeof INTERVALS;
      const resolved = resolveInterval(typedKey);
      if (resolved === typedKey) {
        // Canonical key — no alias to verify; the data is authoritative.
        return;
      }
      // Alias — the stored data must match the canonical entry.
      expect(INTERVALS[typedKey]).toEqual(INTERVALS[resolved]);
    },
  );
});

describe('chord catalog', () => {
  const chordKeys = Object.keys(CHORDS);

  it.each(chordKeys)('chord "%s" resolves to a key that exists in CHORDS', (key) => {
    const typedKey = key as keyof typeof CHORDS;
    const resolved = resolveChordSuffix(typedKey);
    expect(CHORDS).toHaveProperty(resolved);
  });

  it.each(chordKeys)(
    'chord alias "%s" intervals deep-equal the canonical entry it resolves to',
    (key) => {
      const typedKey = key as keyof typeof CHORDS;
      const resolved = resolveChordSuffix(typedKey);
      if (resolved === typedKey) {
        return;
      }
      expect(CHORDS[typedKey].intervals).toEqual(CHORDS[resolved].intervals);
    },
  );
});

describe('scale catalog', () => {
  const scaleKeys = Object.keys(SCALES);

  it.each(scaleKeys)('scale "%s" resolves to a key that exists in SCALES', (key) => {
    const typedKey = key as keyof typeof SCALES;
    const resolved = resolveScaleType(typedKey);
    expect(SCALES).toHaveProperty(resolved);
  });

  it.each(scaleKeys)(
    'scale alias "%s" intervals deep-equal the canonical entry it resolves to',
    (key) => {
      const typedKey = key as keyof typeof SCALES;
      const resolved = resolveScaleType(typedKey);
      if (resolved === typedKey) {
        return;
      }
      expect(SCALES[typedKey].intervals).toEqual(SCALES[resolved].intervals);
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
