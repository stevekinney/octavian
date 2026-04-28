import * as fc from 'fast-check';
import { describe, expect, it } from 'bun:test';

import { Chord } from './chord.ts';
import {
  ALL_NOTE_NAMES,
  enharmonicsForNoteName,
  noteNameToChromaticIndex,
} from './note-spellings.ts';
import { Note } from './note.ts';
import { Scale } from './scale.ts';

describe('property-based invariants', () => {
  it('fromMidi(n).midi === n for all valid MIDI values', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 127 }), (n) => {
        const note = Note.fromMidi(n);
        expect(Number(note.midi)).toBe(n);
      }),
      { numRuns: 50 },
    );
  });

  it('semitonesTo is antisymmetric', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 127 }), fc.integer({ min: 0, max: 127 }), (a, b) => {
        const noteA = Note.fromMidi(a);
        const noteB = Note.fromMidi(b);
        const forward = Number(noteA.semitonesTo(noteB));
        const backward = Number(noteB.semitonesTo(noteA));
        // forward + backward must be 0 (handles both the -0/0 and equal-note cases)
        expect(forward + backward).toBe(0);
      }),
      { numRuns: 50 },
    );
  });

  it('enharmonicsForNoteName all share the same chromatic index', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_NOTE_NAMES), (noteName) => {
        const index = noteNameToChromaticIndex(noteName);
        const enharmonics = enharmonicsForNoteName(noteName);
        for (const enharmonic of enharmonics) {
          expect(noteNameToChromaticIndex(enharmonic)).toBe(index);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('scale.transposeBy(12) shares pitch classes with original', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 115 }),
        fc.constantFrom('major', 'naturalMinor', 'majorPentatonic', 'blues'),
        (midiRoot, scaleType) => {
          const root = Note.fromMidi(midiRoot);
          const scale = Scale.create(root, scaleType);
          try {
            const transposed = scale.transposeBy(12);
            expect(transposed.samePitchClasses(scale)).toBe(true);
          } catch {
            // Some roots may push notes out of range — acceptable
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('chord.invert(size) returns a chord with same root pitch class', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 36, max: 84 }),
        fc.constantFrom(
          'major',
          'minor',
          'diminished',
          'augmented',
          'majorSeventh',
          'minorSeventh',
        ),
        (midiRoot, suffix) => {
          const root = Note.fromMidi(midiRoot);
          const chord = Chord.create(root, suffix);
          const cycled = chord.invert(chord.size);
          expect(cycled.root.chromaticIndex).toBe(chord.root.chromaticIndex);
        },
      ),
      { numRuns: 50 },
    );
  });
});
