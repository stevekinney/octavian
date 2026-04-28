import { describe, expect, it } from 'bun:test';

import { Chord } from './chord.js';
import { resolveChordSuffix } from './chords.js';
import { resolveInterval } from './intervals.js';
import { Note, noteToFrequency } from './note.js';
import { Scale } from './scale.js';
import { resolveScaleType } from './scales.js';
import { STANDARD_TUNING } from './tuning.js';

/**
 * Backward-compatibility contract for the public surface defined at the start
 * of the roadmap (Phase 0.75). The intent is a guardrail on intentional
 * documented public guarantees, not a freeze of every accidental quirk.
 *
 * Out of scope (allowed to change as roadmap items land): internal numeric
 * precision beyond 6 decimal places, enharmonic preference choices,
 * IntervalInformation/ScaleInformation/Tuning shape changes, triple
 * accidental presence in enharmonics.
 */
describe('backward-compatibility contract', () => {
  describe('STANDARD_TUNING legacy fields', () => {
    it('preserves reference and frequency fields', () => {
      // The "shape" guarantee is on these legacy fields, not on exact object
      // shape. Item 4.4 widens Tuning with an optional `kind` field; that
      // remains compatible because consumers reading `reference`/`frequency`
      // continue to work.
      expect(STANDARD_TUNING.reference).toBe('A4');
      expect(Number(STANDARD_TUNING.frequency)).toBe(440);
    });

    it('produces canonical A4=440 and C4≈261.625565 under noteToFrequency', () => {
      const a4 = Number(noteToFrequency(Note.create('A4'), STANDARD_TUNING));
      const c4 = Number(noteToFrequency(Note.create('C4'), STANDARD_TUNING));
      expect(a4.toFixed(6)).toBe('440.000000');
      expect(c4.toFixed(6)).toBe('261.625565');
    });
  });

  describe('canonical resolver determinism', () => {
    // Canonical names — a representative set per catalog, NOT aliases.
    // Aliases are tested in src/catalog.test.ts; this contract pins only that
    // canonical names round-trip through the resolver as identity.
    const canonicalIntervals = [
      'perfectUnison',
      'majorThird',
      'perfectFifth',
      'minorSeventh',
      'perfectOctave',
      'majorNinth',
      'augmentedFourth',
      'diminishedFifth',
    ] as const;
    const canonicalChordSuffixes = [
      'major',
      'minor',
      'diminished',
      'augmented',
      'majorSeventh',
      'minorSeventh',
      'dominantSeventh',
      'halfDiminishedSeventh',
    ] as const;
    const canonicalScaleTypes = [
      'major',
      'naturalMinor',
      'harmonicMinor',
      'melodicMinor',
      'dorian',
      'lydian',
      'mixolydian',
      'majorPentatonic',
    ] as const;

    it('resolveInterval is identity on canonical names', () => {
      for (const canonical of canonicalIntervals) {
        expect(resolveInterval(canonical)).toBe(canonical);
      }
    });

    it('resolveChordSuffix is identity on canonical suffixes', () => {
      for (const canonical of canonicalChordSuffixes) {
        expect(resolveChordSuffix(canonical)).toBe(canonical);
      }
    });

    it('resolveScaleType is identity on canonical scale types', () => {
      for (const canonical of canonicalScaleTypes) {
        expect(resolveScaleType(canonical)).toBe(canonical);
      }
    });
  });

  describe('JSON round-trip identity (representative)', () => {
    it('Note round-trips for one example per accidental class', () => {
      for (const name of ['C4', 'C#4', 'Db4', 'C##4', 'Cbb4'] as const) {
        const original = Note.create(name);
        const restored = Note.create(original.toJSON());
        expect(restored.equals(original)).toBe(true);
      }
    });

    it('Chord round-trips for one major and one minor seventh', () => {
      const cmaj7 = Chord.create('C4', 'majorSeventh');
      const dm7 = Chord.create('D4', 'minorSeventh');
      expect(Chord.fromJSON(cmaj7.toJSON()).equals(cmaj7)).toBe(true);
      expect(Chord.fromJSON(dm7.toJSON()).equals(dm7)).toBe(true);
    });

    it('Scale round-trips for one major and one minor', () => {
      const cMajor = Scale.create('C4', 'major');
      const aMinor = Scale.create('A3', 'naturalMinor');
      expect(Scale.fromJSON(cMajor.toJSON()).equals(cMajor)).toBe(true);
      expect(Scale.fromJSON(aMinor.toJSON()).equals(aMinor)).toBe(true);
    });
  });

  describe('README pinned-value smoke', () => {
    it('Note.create(A4).frequency === 440', () => {
      expect(Number(Note.create('A4').frequency)).toBe(440);
    });

    it('Note.create(C4).midi === 60', () => {
      expect(Number(Note.create('C4').midi)).toBe(60);
    });

    it('Chord.create(C4, major) builds C-E-G', () => {
      const chord = Chord.create('C4', 'major');
      expect(chord.notes.map((n) => n.toString())).toEqual(['C4', 'E4', 'G4']);
    });

    it('Scale.create(C4, major) is a 7-note scale rooted at C4', () => {
      const scale = Scale.create('C4', 'major');
      expect(scale.notes.length).toBe(7);
      expect(scale.notes[0]?.toString()).toBe('C4');
      expect(scale.notes[6]?.toString()).toBe('B4');
    });
  });

  describe('constructor protection (compile-time invariant)', () => {
    it('Note is constructible only via static factories', () => {
      // Static factory works
      const noteViaCreate = Note.create('C4');
      expect(noteViaCreate.toString()).toBe('C4');
      // Direct `new Note(...)` is rejected by TypeScript at the protected
      // constructor (compile-time guarantee). We don't exercise the runtime
      // behavior here because the language guarantee is the contract.
    });
  });
});
