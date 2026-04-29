import { describe, expect, it } from 'bun:test';

import { Chord } from './chord.js';
import { Key, isKnownKey } from './key.js';
import { KEY_SIGNATURES } from './key-signature-catalog.js';
import type { NoteName } from './note-spellings.js';
import { Note } from './note.js';
import { Scale } from './scale.js';

describe('Key.create', () => {
  it('creates a major key from tonic + mode strings', () => {
    const cMajor = Key.create('C', 'major');
    expect(cMajor.tonic.toString()).toBe('C4');
    expect(cMajor.mode).toBe('major');
    expect(cMajor.signature).toBe(KEY_SIGNATURES['C-major']);
  });

  it('creates a minor key', () => {
    const aMinor = Key.create('A', 'minor');
    expect(aMinor.tonic.note).toBe('A');
    expect(aMinor.mode).toBe('minor');
  });

  it('accepts a Note as tonic', () => {
    const ebMajor = Key.create(Note.create('Eb4'), 'major');
    expect(ebMajor.tonic.note).toBe('Eb');
    expect(ebMajor.signature.accidentalCount).toBe(3);
  });

  it('accepts a SerializedKey-shaped object', () => {
    const fSharpMajor = Key.create({ tonic: 'F#', mode: 'major' });
    expect(fSharpMajor.tonic.note).toBe('F#');
    expect(fSharpMajor.mode).toBe('major');
  });

  it('returns the same Key instance when given a Key', () => {
    const original = Key.create('G', 'major');
    expect(Key.create(original)).toBe(original);
  });

  it('returns the same Key when given a Key and a matching mode', () => {
    const original = Key.create('G', 'major');
    expect(Key.create(original, 'major')).toBe(original);
  });

  it('throws TypeError when given a Key and a different mode', () => {
    const original = Key.create('G', 'major');
    expect(() => Key.create(original, 'minor')).toThrow(TypeError);
  });

  it('throws TypeError when called without a mode and without a SerializedKey', () => {
    expect(() => Key.create('G' as never)).toThrow(TypeError);
  });

  it('throws TypeError for a tonic+mode combination not in the catalog', () => {
    expect(() => Key.create('E#', 'major')).toThrow(TypeError);
  });

  it('throws TypeError for theoretical keys (G# major, Fb major, etc.)', () => {
    // Theoretical keys live in the catalog but are not constructible as
    // `Key` instances — their relationship getters would target tonics
    // outside the catalog. Use the enharmonic standard key instead.
    expect(() => Key.create('G#', 'major')).toThrow(TypeError);
    expect(() => Key.create('Fb', 'major')).toThrow(TypeError);
  });
});

describe('Key.fromJSON', () => {
  it('round-trips a key through toJSON/fromJSON', () => {
    const original = Key.create('Bb', 'major');
    const restored = Key.fromJSON(original.toJSON());
    expect(restored.equals(original)).toBe(true);
  });
});

describe('Key.isKey', () => {
  it('returns true for Key instances', () => {
    expect(Key.isKey(Key.create('C', 'major'))).toBe(true);
  });

  it('returns false for non-Key values', () => {
    expect(Key.isKey('C major')).toBe(false);
    expect(Key.isKey({ tonic: 'C', mode: 'major' })).toBe(false);
    expect(Key.isKey(null)).toBe(false);
  });
});

describe('Key derived properties', () => {
  it('derives the diatonic scale correctly for a major key', () => {
    const cMajor = Key.create('C', 'major');
    expect(cMajor.scale).toBeInstanceOf(Scale);
    expect(cMajor.scale.notes.map((n) => n.note)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });

  it('derives the natural minor scale for a minor key', () => {
    const aMinor = Key.create('A', 'minor');
    expect(aMinor.scale.notes.map((n) => n.note)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });
});

describe('Key relationships', () => {
  it('relativeKey of C major is A minor', () => {
    expect(Key.create('C', 'major').relativeKey.equals(Key.create('A', 'minor'))).toBe(true);
  });

  it('relativeKey of A minor is C major', () => {
    expect(Key.create('A', 'minor').relativeKey.equals(Key.create('C', 'major'))).toBe(true);
  });

  it('parallelKey flips the mode and keeps the tonic', () => {
    const cMajor = Key.create('C', 'major');
    expect(cMajor.parallelKey.equals(Key.create('C', 'minor'))).toBe(true);
    expect(Key.create('A', 'minor').parallelKey.equals(Key.create('A', 'major'))).toBe(true);
  });

  it('dominantKey is the perfect fifth above (clockwise)', () => {
    expect(Key.create('C', 'major').dominantKey.equals(Key.create('G', 'major'))).toBe(true);
    expect(Key.create('A', 'minor').dominantKey.equals(Key.create('E', 'minor'))).toBe(true);
  });

  it('subdominantKey is the perfect fifth below (counter-clockwise)', () => {
    expect(Key.create('C', 'major').subdominantKey.equals(Key.create('F', 'major'))).toBe(true);
    expect(Key.create('A', 'minor').subdominantKey.equals(Key.create('D', 'minor'))).toBe(true);
  });
});

describe('Key.distanceInFifths', () => {
  it('returns 0 for same key', () => {
    const c = Key.create('C', 'major');
    expect(Key.distanceInFifths(c, c)).toBe(0);
  });

  it('returns +1 for dominant', () => {
    expect(Key.distanceInFifths(Key.create('C', 'major'), Key.create('G', 'major'))).toBe(1);
  });

  it('returns -1 for subdominant', () => {
    expect(Key.distanceInFifths(Key.create('C', 'major'), Key.create('F', 'major'))).toBe(-1);
  });
});

describe('Key.adjacentKeys', () => {
  it('returns dominant and subdominant on the circle', () => {
    const adjacent = Key.adjacentKeys(Key.create('C', 'major'));
    expect(adjacent.dominant.equals(Key.create('G', 'major'))).toBe(true);
    expect(adjacent.subdominant.equals(Key.create('F', 'major'))).toBe(true);
  });
});

describe('Key.enharmonicEquivalent', () => {
  it('returns the flat-side equivalent for a sharp-side key', () => {
    const fSharp = Key.create('F#', 'major');
    const equivalent = Key.enharmonicEquivalent(fSharp);
    expect(equivalent).not.toBeNull();
    expect(equivalent!.tonic.note).toBe('Gb');
  });

  it('returns null when there is no standard equivalent', () => {
    expect(Key.enharmonicEquivalent(Key.create('C', 'major'))).toBeNull();
  });
});

describe('key.diatonicChords', () => {
  it('returns 7 triads for a major key', () => {
    const chords = Key.create('C', 'major').diatonicChords();
    expect(chords).toHaveLength(7);
    expect(chords.every((chord) => chord instanceof Chord)).toBe(true);
  });

  it('builds C-major triads at the expected qualities', () => {
    const chords = Key.create('C', 'major').diatonicChords();
    expect(chords[0]!.suffix).toBe('major'); // I
    expect(chords[1]!.suffix).toBe('minor'); // ii
    expect(chords[3]!.suffix).toBe('major'); // IV
    expect(chords[4]!.suffix).toBe('major'); // V
    expect(chords[6]!.suffix).toBe('diminished'); // vii°
  });

  it('builds A-minor triads at the expected qualities', () => {
    const chords = Key.create('A', 'minor').diatonicChords();
    expect(chords[0]!.suffix).toBe('minor'); // i
    expect(chords[1]!.suffix).toBe('diminished'); // ii°
    expect(chords[3]!.suffix).toBe('minor'); // iv
    expect(chords[4]!.suffix).toBe('minor'); // v (natural minor)
  });
});

describe('key.diatonicSeventhChords', () => {
  it('returns 7 seventh chords', () => {
    const sevenths = Key.create('C', 'major').diatonicSeventhChords();
    expect(sevenths).toHaveLength(7);
  });

  it('builds Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7b5 in C major', () => {
    const sevenths = Key.create('C', 'major').diatonicSeventhChords();
    expect(sevenths[0]!.suffix).toBe('majorSeventh');
    expect(sevenths[1]!.suffix).toBe('minorSeventh');
    expect(sevenths[4]!.suffix).toBe('dominantSeventh');
    expect(sevenths[6]!.suffix).toBe('halfDiminishedSeventh');
  });
});

describe('key.contains', () => {
  it('returns true for diatonic notes (any octave)', () => {
    const cMajor = Key.create('C', 'major');
    expect(cMajor.contains(Note.create('C4'))).toBe(true);
    expect(cMajor.contains(Note.create('G5'))).toBe(true);
    expect(cMajor.contains(Note.create('B2'))).toBe(true);
  });

  it('returns false for non-diatonic notes', () => {
    const cMajor = Key.create('C', 'major');
    expect(cMajor.contains(Note.create('C#4'))).toBe(false);
    expect(cMajor.contains(Note.create('Eb4'))).toBe(false);
  });

  it('treats enharmonic spellings as members by pitch class', () => {
    // Membership is by chromatic index, not spelling. Cb (pc=11) matches
    // B (pc=11), so C major (which contains B) reports Cb as a member.
    // E# (pc=5) matches F. Documented behavior — change `Scale.has` if the
    // semantic ever shifts to spelling-based membership.
    const cMajor = Key.create('C', 'major');
    expect(cMajor.contains(Note.create('Cb4'))).toBe(true);
    expect(cMajor.contains(Note.create('E#4'))).toBe(true);
  });

  it('returns true for diatonic chords', () => {
    const cMajor = Key.create('C', 'major');
    expect(cMajor.contains(Chord.create('C4', 'major'))).toBe(true);
    expect(cMajor.contains(Chord.create('G4', 'major'))).toBe(true);
    expect(cMajor.contains(Chord.create('A4', 'minor'))).toBe(true);
  });

  it('returns false for chords that contain non-diatonic notes', () => {
    const cMajor = Key.create('C', 'major');
    expect(cMajor.contains(Chord.create('D4', 'major'))).toBe(false);
    expect(cMajor.contains(Chord.create('A4', 'major'))).toBe(false);
  });
});

describe('Key relationship invariants — exhaustive sweep', () => {
  // Build the full set of standard, Key.create-able tonics for sweeps.
  const STANDARD_MAJOR_TONICS: readonly NoteName[] = [
    'C',
    'G',
    'D',
    'A',
    'E',
    'B',
    'F#',
    'C#',
    'F',
    'Bb',
    'Eb',
    'Ab',
    'Db',
    'Gb',
    'Cb',
  ];
  const STANDARD_MINOR_TONICS: readonly NoteName[] = [
    'A',
    'E',
    'B',
    'F#',
    'C#',
    'G#',
    'D#',
    'A#',
    'D',
    'G',
    'C',
    'F',
    'Bb',
    'Eb',
    'Ab',
  ];

  it('relativeKey is an involution (up to enharmonic equivalence) for every standard major key', () => {
    // Some keys (e.g., Cb-major) have a relative minor whose direct
    // spelling isn't in the catalog (Ab-minor → resolved). Going back
    // takes the catalog spelling, which may differ from the original.
    // The pitch-class identity holds (`isEnharmonicTo`).
    for (const tonic of STANDARD_MAJOR_TONICS) {
      const key = Key.create(tonic, 'major');
      expect(key.relativeKey.relativeKey.isEnharmonicTo(key)).toBe(true);
    }
  });

  it('relativeKey is an involution (up to enharmonic equivalence) for every standard minor key', () => {
    for (const tonic of STANDARD_MINOR_TONICS) {
      const key = Key.create(tonic, 'minor');
      expect(key.relativeKey.relativeKey.isEnharmonicTo(key)).toBe(true);
    }
  });

  it('parallelKey is an involution (up to enharmonic equivalence) for every standard key', () => {
    // Same caveat: Db-major.parallelKey resolves to C#-minor (Db-minor
    // isn't catalogued); going back lands on C#-major, not Db-major.
    // Pitch-class identity holds.
    for (const tonic of STANDARD_MAJOR_TONICS) {
      const key = Key.create(tonic, 'major');
      expect(key.parallelKey.parallelKey.isEnharmonicTo(key)).toBe(true);
    }
    for (const tonic of STANDARD_MINOR_TONICS) {
      const key = Key.create(tonic, 'minor');
      expect(key.parallelKey.parallelKey.isEnharmonicTo(key)).toBe(true);
    }
  });
});

describe('key.transpose / transposeBy', () => {
  it('transposes by interval', () => {
    const cMajor = Key.create('C', 'major');
    expect(cMajor.transpose('perfectFifth').equals(Key.create('G', 'major'))).toBe(true);
    expect(cMajor.transpose('majorSecond').equals(Key.create('D', 'major'))).toBe(true);
  });

  it('transposes by semitones', () => {
    const cMajor = Key.create('C', 'major');
    expect(cMajor.transposeBy(7).equals(Key.create('G', 'major'))).toBe(true);
  });
});

describe('key.equals / isEnharmonicTo', () => {
  it('equals requires identical tonic spelling and mode', () => {
    expect(Key.create('C', 'major').equals(Key.create('C', 'major'))).toBe(true);
    expect(Key.create('C', 'major').equals(Key.create('C', 'minor'))).toBe(false);
    expect(Key.create('F#', 'major').equals(Key.create('Gb', 'major'))).toBe(false);
  });

  it('isEnharmonicTo allows differently-spelled tonics if pitch classes match', () => {
    expect(Key.create('F#', 'major').isEnharmonicTo(Key.create('Gb', 'major'))).toBe(true);
    expect(Key.create('C', 'major').isEnharmonicTo(Key.create('C', 'minor'))).toBe(false);
  });
});

describe('key.toString', () => {
  it('renders as "<tonic> <mode>"', () => {
    expect(Key.create('Bb', 'major').toString()).toBe('Bb major');
    expect(Key.create('A', 'minor').toString()).toBe('A minor');
  });

  it('exposes a Symbol.toStringTag', () => {
    expect(Object.prototype.toString.call(Key.create('C', 'major'))).toBe('[object Key(C major)]');
  });
});

describe('isKnownKey', () => {
  it('returns true for standard catalog members', () => {
    expect(isKnownKey('C', 'major')).toBe(true);
    expect(isKnownKey('Bb', 'major')).toBe(true);
    expect(isKnownKey('F#', 'major')).toBe(true);
    expect(isKnownKey('A', 'minor')).toBe(true);
  });

  it('returns false for theoretical keys (catalog has them, Key.create rejects them)', () => {
    // G#-major is in KEY_SIGNATURES with accidentalPreference 'theoretical',
    // but isKnownKey reports the Key.create-constructible set, not the
    // catalog set. Use keySignatureFor for catalog-only access.
    expect(isKnownKey('G#', 'major')).toBe(false);
    expect(isKnownKey('Fb', 'major')).toBe(false);
  });

  it('returns false for tonic+mode combinations not in the catalog at all', () => {
    expect(isKnownKey('E#', 'major')).toBe(false);
  });
});
