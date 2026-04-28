import { describe, expect, it } from 'bun:test';

import { Scale } from './scale.js';
import {
  KEY_SIGNATURES,
  keySignatureFor,
  keySignatureFromAccidentals,
  type KeySignatureInformation,
} from './key-signature-catalog.js';

describe('KEY_SIGNATURES catalog', () => {
  it('contains 30 standard keys plus theoretical extensions', () => {
    const standard = Object.values(KEY_SIGNATURES).filter(
      (signature) => signature.accidentalPreference !== 'theoretical',
    );
    expect(standard.length).toBe(30);

    const theoretical = Object.values(KEY_SIGNATURES).filter(
      (signature) => signature.accidentalPreference === 'theoretical',
    );
    expect(theoretical.length).toBeGreaterThan(0);
  });

  it('places C major and A minor at zero accidentals with order none', () => {
    expect(KEY_SIGNATURES['C-major'].accidentalCount).toBe(0);
    expect(KEY_SIGNATURES['C-major'].order).toBe('none');
    expect(KEY_SIGNATURES['C-major'].accidentals).toEqual([]);
    expect(KEY_SIGNATURES['A-minor'].accidentalCount).toBe(0);
    expect(KEY_SIGNATURES['A-minor'].order).toBe('none');
  });

  it('uses sharp order F# C# G# D# A# E# B# (then double-sharp variants)', () => {
    expect(KEY_SIGNATURES['G-major'].accidentals).toEqual(['F#']);
    expect(KEY_SIGNATURES['D-major'].accidentals).toEqual(['F#', 'C#']);
    expect(KEY_SIGNATURES['A-major'].accidentals).toEqual(['F#', 'C#', 'G#']);
    expect(KEY_SIGNATURES['C#-major'].accidentals).toEqual([
      'F#',
      'C#',
      'G#',
      'D#',
      'A#',
      'E#',
      'B#',
    ]);
  });

  it('uses flat order Bb Eb Ab Db Gb Cb Fb', () => {
    expect(KEY_SIGNATURES['F-major'].accidentals).toEqual(['Bb']);
    expect(KEY_SIGNATURES['Bb-major'].accidentals).toEqual(['Bb', 'Eb']);
    expect(KEY_SIGNATURES['Cb-major'].accidentals).toEqual([
      'Bb',
      'Eb',
      'Ab',
      'Db',
      'Gb',
      'Cb',
      'Fb',
    ]);
  });

  it('includes both enharmonic spellings for the bottom of the circle', () => {
    expect(KEY_SIGNATURES['F#-major']).toBeDefined();
    expect(KEY_SIGNATURES['Gb-major']).toBeDefined();
    expect(KEY_SIGNATURES['C#-major']).toBeDefined();
    expect(KEY_SIGNATURES['Db-major']).toBeDefined();
  });

  it('marks theoretical keys with accidentalPreference theoretical', () => {
    expect(KEY_SIGNATURES['G#-major'].accidentalPreference).toBe('theoretical');
    expect(KEY_SIGNATURES['Fb-major'].accidentalPreference).toBe('theoretical');
  });

  it('theoretical keys with >7 accidentals store the full set including double accidentals', () => {
    const gSharpMajor = KEY_SIGNATURES['G#-major'];
    expect(gSharpMajor.accidentalCount).toBe(8);
    expect(gSharpMajor.accidentals).toHaveLength(8);
    expect(gSharpMajor.accidentals[7]).toBe('F##');

    const fFlatMajor = KEY_SIGNATURES['Fb-major'];
    expect(fFlatMajor.accidentalCount).toBe(8);
    expect(fFlatMajor.accidentals).toHaveLength(8);
    expect(fFlatMajor.accidentals[7]).toBe('Bbb');

    // The most-extreme theoretical key in the catalog: A# major has 10 sharps.
    const aSharpMajor = KEY_SIGNATURES['A#-major'];
    expect(aSharpMajor.accidentalCount).toBe(10);
    expect(aSharpMajor.accidentals).toHaveLength(10);
    expect(aSharpMajor.accidentals).toContain('G##');
  });

  it('parallels minor keys to their relative major (both have same accidental count)', () => {
    // Relative pairs:
    expect(KEY_SIGNATURES['G-major'].accidentalCount).toBe(
      KEY_SIGNATURES['E-minor'].accidentalCount,
    );
    expect(KEY_SIGNATURES['D-major'].accidentalCount).toBe(
      KEY_SIGNATURES['B-minor'].accidentalCount,
    );
    expect(KEY_SIGNATURES['F-major'].accidentalCount).toBe(
      KEY_SIGNATURES['D-minor'].accidentalCount,
    );
    expect(KEY_SIGNATURES['Eb-major'].accidentalCount).toBe(
      KEY_SIGNATURES['C-minor'].accidentalCount,
    );
  });
});

describe('keySignatureFor', () => {
  it('returns the catalog entry for a sharp-key tonic', () => {
    const gMajor = keySignatureFor('G', 'major');
    expect(gMajor.tonic).toBe('G');
    expect(gMajor.mode).toBe('major');
    expect(gMajor.accidentalCount).toBe(1);
    expect(gMajor.order).toBe('sharps');
  });

  it('returns the catalog entry for a flat-key tonic', () => {
    const bbMajor = keySignatureFor('Bb', 'major');
    expect(bbMajor.tonic).toBe('Bb');
    expect(bbMajor.mode).toBe('major');
    expect(bbMajor.accidentalCount).toBe(2);
    expect(bbMajor.order).toBe('flats');
  });

  it('returns minor-mode entries', () => {
    const dMinor = keySignatureFor('D', 'minor');
    expect(dMinor.tonic).toBe('D');
    expect(dMinor.mode).toBe('minor');
    expect(dMinor.accidentalCount).toBe(1);
    expect(dMinor.order).toBe('flats');
  });

  it('throws TypeError for valid tonic+mode combinations not in the catalog', () => {
    // E# is a valid NoteName but the catalog has no E#-major (that would be
    // the enharmonic theoretical equivalent of F major — not represented).
    expect(() => keySignatureFor('E#', 'major')).toThrow(TypeError);
  });
});

describe('keySignatureFromAccidentals', () => {
  it('returns relative-pair major and minor for sharp counts 1–7', () => {
    const oneSharp = keySignatureFromAccidentals(1, 'sharps');
    const tonics = oneSharp.map((s) => `${s.tonic}-${s.mode}`).toSorted();
    expect(tonics).toEqual(['E-minor', 'G-major']);
  });

  it('returns relative-pair major and minor for flat counts 1–7', () => {
    const twoFlats = keySignatureFromAccidentals(2, 'flats');
    const tonics = twoFlats.map((s) => `${s.tonic}-${s.mode}`).toSorted();
    expect(tonics).toEqual(['Bb-major', 'G-minor']);
  });

  it('returns C major and A minor for count 0 / order none', () => {
    const noAccidentals = keySignatureFromAccidentals(0, 'none');
    const tonics = noAccidentals.map((s) => `${s.tonic}-${s.mode}`).toSorted();
    expect(tonics).toEqual(['A-minor', 'C-major']);
  });

  it('excludes theoretical keys', () => {
    const eightSharps = () => keySignatureFromAccidentals(8, 'sharps');
    expect(eightSharps).toThrow(RangeError);
  });

  it('throws RangeError when count is negative or not an integer', () => {
    expect(() => keySignatureFromAccidentals(-1, 'sharps')).toThrow(RangeError);
    expect(() => keySignatureFromAccidentals(1.5, 'sharps')).toThrow(RangeError);
  });

  it('throws RangeError when count and order disagree', () => {
    expect(() => keySignatureFromAccidentals(0, 'sharps')).toThrow(RangeError);
    expect(() => keySignatureFromAccidentals(3, 'none')).toThrow(RangeError);
  });
});

describe('round-trip — every entry spells its scale correctly', () => {
  // Property-style: the accidentals listed in each key signature must be
  // exactly the accidentals that appear in the corresponding scale's notes.
  it.each(
    Object.entries(KEY_SIGNATURES).filter(
      ([, signature]) => signature.accidentalPreference !== 'theoretical',
    ),
  )(
    '%s spells its scale with the catalog accidentals',
    (_label, signature: KeySignatureInformation) => {
      const scaleType = signature.mode === 'major' ? 'major' : 'naturalMinor';
      const scale = Scale.create(`${signature.tonic}4`, scaleType);
      const scaleAccidentals = new Set<string>();
      for (const note of scale.notes) {
        const noteName = note.note;
        // Notes have an accidental if they aren't naturals (single uppercase).
        if (noteName.length > 1) {
          scaleAccidentals.add(noteName);
        }
      }
      const catalogAccidentals = new Set(signature.accidentals);
      expect(scaleAccidentals).toEqual(catalogAccidentals);
    },
  );
});
