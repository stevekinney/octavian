import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';
import { Chord } from './chord.js';
import { Key } from './key.js';
import { Scale } from './scale.js';
import {
  formatChord,
  formatKey,
  formatScale,
  parseChordName,
  parseKeyName,
  parseScaleName,
} from './theory-parsers.js';

// ---------------------------------------------------------------------------
// parseChordName / Chord.parse
// ---------------------------------------------------------------------------

describe('parseChordName', () => {
  it('parses a major triad root only', () => {
    const chord = parseChordName('C');
    expect(chord.root.note).toBe('C');
    expect(chord.suffix).toBe('major');
    expect(chord.inversionIndex).toBe(0);
  });

  it('parses a minor triad', () => {
    const chord = parseChordName('Am');
    expect(chord.root.note).toBe('A');
    expect(chord.suffix).toBe('minor');
  });

  it('parses a diminished triad', () => {
    const chord = parseChordName('Bdim');
    expect(chord.root.note).toBe('B');
    expect(chord.suffix).toBe('diminished');
  });

  it('parses a major seventh chord', () => {
    const chord = parseChordName('Cmaj7');
    expect(chord.root.note).toBe('C');
    expect(chord.suffix).toBe('majorSeventh');
  });

  it('parses a dominant seventh chord', () => {
    const chord = parseChordName('G7');
    expect(chord.root.note).toBe('G');
    expect(chord.suffix).toBe('dominantSeventh');
  });

  it('parses a minor seventh chord', () => {
    const chord = parseChordName('Dm7');
    expect(chord.root.note).toBe('D');
    expect(chord.suffix).toBe('minorSeventh');
  });

  it('parses a diminished seventh chord', () => {
    const chord = parseChordName('F#dim7');
    expect(chord.root.note).toBe('F#');
    expect(chord.suffix).toBe('diminishedSeventh');
  });

  it('parses a flat-root chord (Bb)', () => {
    const chord = parseChordName('Bb');
    expect(chord.root.note).toBe('Bb');
    expect(chord.suffix).toBe('major');
  });

  it('parses a flat-root minor chord (Bbm)', () => {
    const chord = parseChordName('Bbm');
    expect(chord.root.note).toBe('Bb');
    expect(chord.suffix).toBe('minor');
  });

  it('parses a Db chord', () => {
    const chord = parseChordName('Db');
    expect(chord.root.note).toBe('Db');
    expect(chord.suffix).toBe('major');
  });

  it('parses slash chord Cmaj7/E (first inversion)', () => {
    const chord = parseChordName('Cmaj7/E');
    expect(chord.root.note).toBe('C');
    expect(chord.suffix).toBe('majorSeventh');
    expect(chord.bass.note).toBe('E');
    expect(chord.inversionIndex).toBe(1);
  });

  it('parses slash chord C7b9/G', () => {
    const chord = parseChordName('C7b9/G');
    expect(chord.root.note).toBe('C');
    expect(chord.suffix).toBe('dominantSevenFlatNine');
    expect(chord.bass.note).toBe('G');
  });

  it('parses unicode flat symbol in chord name', () => {
    const chord = parseChordName('C7♭9');
    expect(chord.root.note).toBe('C');
    expect(chord.suffix).toBe('dominantSevenFlatNine');
  });

  it('parses unicode sharp symbol in chord name', () => {
    const chord = parseChordName('C7♯9');
    expect(chord.root.note).toBe('C');
    expect(chord.suffix).toBe('dominantSevenSharpNine');
  });

  it('parses mMaj7 chord', () => {
    const chord = parseChordName('CmMaj7');
    expect(chord.root.note).toBe('C');
    expect(chord.suffix).toBe('minorMajorSeventh');
  });

  it('parses augmented chord', () => {
    const chord = parseChordName('Caug');
    expect(chord.root.note).toBe('C');
    expect(chord.suffix).toBe('augmented');
  });

  it('parses sus2 chord', () => {
    const chord = parseChordName('Dsus2');
    expect(chord.root.note).toBe('D');
    expect(chord.suffix).toBe('suspendedSecond');
  });

  it('parses 6/9 chord symbol', () => {
    const chord = parseChordName('C6/9');
    expect(chord.root.note).toBe('C');
    expect(chord.suffix).toBe('sixthAddNine');
  });

  it('trims leading/trailing whitespace', () => {
    const chord = parseChordName('  Am  ');
    expect(chord.root.note).toBe('A');
    expect(chord.suffix).toBe('minor');
  });

  it('throws TypeError for unknown root (H major)', () => {
    expect(() => parseChordName('Hmaj7')).toThrow(TypeError);
  });

  it('throws TypeError for unrecognized suffix', () => {
    expect(() => parseChordName('Cxyz')).toThrow(TypeError);
  });

  it('throws TypeError for invalid slash bass note', () => {
    expect(() => parseChordName('Cmaj7/H')).toThrow(TypeError);
  });

  it('throws TypeError when bass note is not a chord tone', () => {
    // D is not in C major triad
    expect(() => parseChordName('C/D')).toThrow(TypeError);
  });

  it('throws TypeError for empty string', () => {
    expect(() => parseChordName('')).toThrow(TypeError);
  });
});

describe('Chord.parse', () => {
  it('delegates correctly to parseChordName logic', () => {
    const chord = Chord.parse('Cmaj7/E');
    expect(chord.root.note).toBe('C');
    expect(chord.suffix).toBe('majorSeventh');
    expect(chord.bass.note).toBe('E');
  });

  it('parses Am correctly', () => {
    const chord = Chord.parse('Am');
    expect(chord.root.note).toBe('A');
    expect(chord.suffix).toBe('minor');
  });

  it('throws TypeError for unknown input', () => {
    expect(() => Chord.parse('Hm')).toThrow(TypeError);
  });

  it('throws TypeError for non-chord-tone slash bass (Dm7/G)', () => {
    // G is not a tone of Dm7 (D, F, A, C). Slash chords are inversion-only
    // by design — pedal-point and polychord slashes are out of scope for #29.
    expect(() => Chord.parse('Dm7/G')).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests: formatChord(Chord.parse(x)) parses back equal
// ---------------------------------------------------------------------------

describe('chord round-trip', () => {
  const roundTripCases = ['C', 'Am', 'Bb', 'F#dim7', 'Cmaj7', 'Cmaj7/E', 'Dbmaj7', 'G7', 'Dm7'];

  for (const input of roundTripCases) {
    it(`round-trips "${input}"`, () => {
      const original = parseChordName(input);
      const formatted = formatChord(original);
      const reparsed = parseChordName(formatted);
      expect(reparsed.root.note).toBe(original.root.note);
      expect(reparsed.suffix).toBe(original.suffix);
      expect(reparsed.inversionIndex).toBe(original.inversionIndex);
    });
  }
});

// ---------------------------------------------------------------------------
// Round-trip tests: parseScaleName(formatScale(scale)) produces equal scale
// ---------------------------------------------------------------------------

describe('scale round-trip', () => {
  it('round-trips C naturalMinor', () => {
    const original = Scale.create('C', 'naturalMinor');
    const reparsed = parseScaleName(formatScale(original));
    expect(reparsed.root.note).toBe(original.root.note);
    expect(reparsed.type).toBe(original.type);
  });

  it('round-trips F# melodicMinor', () => {
    const original = Scale.create('F#', 'melodicMinor');
    const reparsed = parseScaleName(formatScale(original));
    expect(reparsed.root.note).toBe(original.root.note);
    expect(reparsed.type).toBe(original.type);
  });

  it('round-trips C diminished', () => {
    const original = Scale.create('C', 'diminished');
    const reparsed = parseScaleName(formatScale(original));
    expect(reparsed.root.note).toBe(original.root.note);
    expect(reparsed.type).toBe(original.type);
  });
});

// ---------------------------------------------------------------------------
// parseScaleName / Scale.parse
// ---------------------------------------------------------------------------

describe('parseScaleName', () => {
  it('parses C major', () => {
    const scale = parseScaleName('C major');
    expect(scale.root.note).toBe('C');
    expect(scale.type).toBe('major');
  });

  it('parses A natural minor', () => {
    const scale = parseScaleName('A natural minor');
    expect(scale.root.note).toBe('A');
    expect(scale.type).toBe('naturalMinor');
  });

  it('parses F# melodic minor', () => {
    const scale = parseScaleName('F# melodic minor');
    expect(scale.root.note).toBe('F#');
    expect(scale.type).toBe('melodicMinor');
  });

  it('parses Db lydian', () => {
    const scale = parseScaleName('Db lydian');
    expect(scale.root.note).toBe('Db');
    expect(scale.type).toBe('lydian');
  });

  it('parses C dorian', () => {
    const scale = parseScaleName('C dorian');
    expect(scale.root.note).toBe('C');
    expect(scale.type).toBe('dorian');
  });

  it('parses G harmonic minor', () => {
    const scale = parseScaleName('G harmonic minor');
    expect(scale.root.note).toBe('G');
    expect(scale.type).toBe('harmonicMinor');
  });

  it('parses Bb major', () => {
    const scale = parseScaleName('Bb major');
    expect(scale.root.note).toBe('Bb');
    expect(scale.type).toBe('major');
  });

  it('parses minor as naturalMinor alias', () => {
    const scale = parseScaleName('A minor');
    expect(scale.type).toBe('naturalMinor');
  });

  it('parses ionian as major alias', () => {
    const scale = parseScaleName('C ionian');
    expect(scale.type).toBe('major');
  });

  it('parses C blues', () => {
    const scale = parseScaleName('C blues');
    expect(scale.type).toBe('blues');
  });

  it('parses C whole tone', () => {
    const scale = parseScaleName('C whole tone');
    expect(scale.type).toBe('wholeTone');
  });

  it('parses C major pentatonic', () => {
    const scale = parseScaleName('C major pentatonic');
    expect(scale.type).toBe('majorPentatonic');
  });

  it('parses A minor pentatonic', () => {
    const scale = parseScaleName('A minor pentatonic');
    expect(scale.type).toBe('minorPentatonic');
  });

  it('parses camelCase type directly', () => {
    const scale = parseScaleName('C melodicMinor');
    expect(scale.type).toBe('melodicMinor');
  });

  it('trims whitespace', () => {
    const scale = parseScaleName('  D major  ');
    expect(scale.root.note).toBe('D');
    expect(scale.type).toBe('major');
  });

  it('throws TypeError for unknown root', () => {
    expect(() => parseScaleName('H major')).toThrow(TypeError);
  });

  it('throws TypeError for unknown scale type', () => {
    expect(() => parseScaleName('C chromatic-super-locrian')).toThrow(TypeError);
  });

  it('throws TypeError for missing scale type', () => {
    expect(() => parseScaleName('C')).toThrow(TypeError);
  });
});

describe('Scale.parse', () => {
  it('delegates correctly', () => {
    const scale = Scale.parse('F# melodic minor');
    expect(scale.root.note).toBe('F#');
    expect(scale.type).toBe('melodicMinor');
  });

  it('throws TypeError for unknown root', () => {
    expect(() => Scale.parse('H major')).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// parseKeyName / Key.parse
// ---------------------------------------------------------------------------

describe('parseKeyName', () => {
  it('parses C major', () => {
    const key = parseKeyName('C major');
    expect(key.tonic.note).toBe('C');
    expect(key.mode).toBe('major');
  });

  it('parses Bb major', () => {
    const key = parseKeyName('Bb major');
    expect(key.tonic.note).toBe('Bb');
    expect(key.mode).toBe('major');
  });

  it('parses F# minor', () => {
    const key = parseKeyName('F# minor');
    expect(key.tonic.note).toBe('F#');
    expect(key.mode).toBe('minor');
  });

  it('parses A minor', () => {
    const key = parseKeyName('A minor');
    expect(key.tonic.note).toBe('A');
    expect(key.mode).toBe('minor');
  });

  it('is case-insensitive for mode part', () => {
    const key = parseKeyName('C Major');
    expect(key.mode).toBe('major');
  });

  it('trims whitespace', () => {
    const key = parseKeyName('  Eb major  ');
    expect(key.tonic.note).toBe('Eb');
    expect(key.mode).toBe('major');
  });

  it('throws TypeError for unknown tonic (H major)', () => {
    expect(() => parseKeyName('H major')).toThrow(TypeError);
  });

  it('throws TypeError for unsupported mode', () => {
    expect(() => parseKeyName('C dorian')).toThrow(TypeError);
  });

  it('throws TypeError for missing mode', () => {
    expect(() => parseKeyName('C')).toThrow(TypeError);
  });

  it('throws TypeError for theoretical keys', () => {
    // G# major is a theoretical key — Key.create rejects it
    expect(() => parseKeyName('G# major')).toThrow(TypeError);
  });
});

describe('Key.parse', () => {
  it('delegates correctly', () => {
    const key = Key.parse('Bb major');
    expect(key.tonic.note).toBe('Bb');
    expect(key.mode).toBe('major');
  });

  it('throws TypeError for unknown input', () => {
    expect(() => Key.parse('H major')).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// formatChord
// ---------------------------------------------------------------------------

describe('formatChord', () => {
  it('returns chord display name', () => {
    const chord = Chord.create('C', 'major');
    expect(formatChord(chord)).toBe('C');
  });

  it('returns slash chord name when inverted', () => {
    const chord = Chord.create('C', 'majorSeventh').slash('E');
    expect(formatChord(chord)).toBe('Cmaj7/E');
  });

  it('forces slash form in root position with forceSlash option', () => {
    const chord = Chord.create('C', 'major');
    expect(formatChord(chord, { forceSlash: true })).toBe('C/C');
  });

  it('returns slash form in first inversion with forceSlash option', () => {
    const chord = Chord.create('G', 'dominantSeventh').slash('B');
    expect(formatChord(chord, { forceSlash: true })).toBe('G7/B');
  });
});

// ---------------------------------------------------------------------------
// formatScale
// ---------------------------------------------------------------------------

describe('formatScale', () => {
  it('returns scale display string', () => {
    const scale = Scale.create('C', 'major');
    expect(formatScale(scale)).toBe('C major');
  });

  it('uses canonical type name in output', () => {
    const scale = Scale.create('A', 'naturalMinor');
    expect(formatScale(scale)).toBe('A naturalMinor');
  });
});

// ---------------------------------------------------------------------------
// formatKey
// ---------------------------------------------------------------------------

describe('formatKey', () => {
  it('returns key display string', () => {
    const key = Key.create('C', 'major');
    expect(formatKey(key)).toBe('C major');
  });

  it('returns minor key display string', () => {
    const key = Key.create('A', 'minor');
    expect(formatKey(key)).toBe('A minor');
  });
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('parseChordName property tests', () => {
  const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Db', 'Eb', 'Gb', 'Ab'];
  const suffixes = ['', 'm', 'dim', 'aug', 'maj7', 'm7', '7', 'dim7'];

  it('always produces a valid Chord for any root+suffix combo', () => {
    fc.assert(
      fc.property(fc.constantFrom(...roots), fc.constantFrom(...suffixes), (root, suffix) => {
        const name = `${root}${suffix}`;
        const chord = parseChordName(name);
        expect(chord.root.note).toBe(root);
        return true;
      }),
      { numRuns: 50 },
    );
  });
});

describe('parseKeyName property tests', () => {
  const keys = [
    ['C', 'major'],
    ['G', 'major'],
    ['D', 'major'],
    ['A', 'major'],
    ['E', 'major'],
    ['B', 'major'],
    ['F', 'major'],
    ['Bb', 'major'],
    ['Eb', 'major'],
    ['Ab', 'major'],
    ['Db', 'major'],
    ['Gb', 'major'],
    ['A', 'minor'],
    ['E', 'minor'],
    ['B', 'minor'],
    ['F#', 'minor'],
    ['D', 'minor'],
    ['G', 'minor'],
    ['C', 'minor'],
    ['F', 'minor'],
    ['Bb', 'minor'],
    ['Eb', 'minor'],
  ] as const;

  it('round-trips tonic+mode through parse', () => {
    fc.assert(
      fc.property(fc.constantFrom(...keys), ([tonic, mode]) => {
        const key = parseKeyName(`${tonic} ${mode}`);
        expect(key.tonic.note).toBe(tonic);
        expect(key.mode).toBe(mode);
        return true;
      }),
      { numRuns: 50 },
    );
  });
});
