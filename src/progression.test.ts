import { describe, expect, it } from 'bun:test';

import { Chord } from './chord.js';
import { Key } from './key.js';
import { chordFromRomanNumeral } from './key-roman.js';
import {
  Progression,
  analyzeProgression,
  detectModulations,
  normalizeJazzSuffix,
  suggestContinuations,
  type ModulationCandidate,
  type ProgressionAnalysis,
  type ProgressionContinuation,
  type ResolvedProgression,
} from './progression.js';

// ---------------------------------------------------------------------------
// normalizeJazzSuffix
// ---------------------------------------------------------------------------

describe('normalizeJazzSuffix', () => {
  it('passes plain figured-bass notation through unchanged', () => {
    expect(normalizeJazzSuffix('I')).toBe('I');
    expect(normalizeJazzSuffix('V7')).toBe('V7');
    expect(normalizeJazzSuffix('ii7')).toBe('ii7');
    expect(normalizeJazzSuffix('vii°7')).toBe('vii°7');
  });

  it('normalizes Imaj7 to I7', () => {
    expect(normalizeJazzSuffix('Imaj7')).toBe('I7');
  });

  it('normalizes iim7 to ii7', () => {
    expect(normalizeJazzSuffix('iim7')).toBe('ii7');
  });

  it('normalizes IVmaj7 to IV7', () => {
    expect(normalizeJazzSuffix('IVmaj7')).toBe('IV7');
  });

  it('normalizes dim suffix to diminished marker', () => {
    expect(normalizeJazzSuffix('viidim')).toBe('vii°');
  });

  it('normalizes °7 suffix (pass-through)', () => {
    expect(normalizeJazzSuffix('vii°7')).toBe('vii°7');
  });

  it('normalizes dim7 suffix to °7', () => {
    expect(normalizeJazzSuffix('viidim7')).toBe('vii°7');
  });

  it('normalizes aug suffix', () => {
    expect(normalizeJazzSuffix('IIIaug')).toBe('III+');
  });

  it('normalizes + suffix', () => {
    expect(normalizeJazzSuffix('III+')).toBe('III+');
  });

  it('normalizes maj suffix (triad with explicit quality)', () => {
    expect(normalizeJazzSuffix('Vmaj')).toBe('V');
  });

  it('normalizes ø7 (half-diminished) suffix', () => {
    expect(normalizeJazzSuffix('iiø7')).toBe('ii°7');
  });

  it('normalizes m suffix (minor triad)', () => {
    expect(normalizeJazzSuffix('Im')).toBe('i');
  });

  it('handles alterations with suffixes', () => {
    expect(normalizeJazzSuffix('bVIImaj7')).toBe('bVII7');
    expect(normalizeJazzSuffix('bVII')).toBe('bVII');
  });

  it('handles applied chord notation', () => {
    expect(normalizeJazzSuffix('V7/V')).toBe('V7/V');
    expect(normalizeJazzSuffix('Vmaj7/IV')).toBe('V7/IV');
  });

  it('returns unrecognized tokens unchanged', () => {
    expect(normalizeJazzSuffix('xyz')).toBe('xyz');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeJazzSuffix('  I  ')).toBe('I');
  });
});

// ---------------------------------------------------------------------------
// Progression.create
// ---------------------------------------------------------------------------

describe('Progression.create', () => {
  it('creates a progression from string numerals', () => {
    const prog = Progression.create(['ii', 'V', 'I']);
    expect(prog.length).toBe(3);
    expect(prog.numerals[0]!.degree).toBe(2);
    expect(prog.numerals[1]!.degree).toBe(5);
    expect(prog.numerals[2]!.degree).toBe(1);
  });

  it('accepts jazz suffix notation (Imaj7, iim7)', () => {
    const prog = Progression.create(['ii7', 'V7', 'Imaj7']);
    expect(prog.numerals[0]!.degree).toBe(2);
    expect(prog.numerals[1]!.degree).toBe(5);
    expect(prog.numerals[2]!.degree).toBe(1);
  });

  it('accepts RomanNumeral instances directly', () => {
    const prog1 = Progression.create(['V', 'I']);
    const prog2 = Progression.create([prog1.numerals[0]!, prog1.numerals[1]!]);
    expect(prog2.length).toBe(2);
  });

  it('throws TypeError for completely invalid input', () => {
    expect(() => Progression.create(['xyz'])).toThrow(TypeError);
  });

  it('creates an empty progression', () => {
    const prog = Progression.create([]);
    expect(prog.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Progression.isProgression
// ---------------------------------------------------------------------------

describe('Progression.isProgression', () => {
  it('returns true for a Progression instance', () => {
    expect(Progression.isProgression(Progression.create(['I', 'V']))).toBe(true);
  });

  it('returns false for non-Progression values', () => {
    expect(Progression.isProgression(null)).toBe(false);
    expect(Progression.isProgression(42)).toBe(false);
    expect(Progression.isProgression('I V I')).toBe(false);
    expect(Progression.isProgression({ numerals: [] })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Progression#in — resolving to concrete chords
// ---------------------------------------------------------------------------

describe('Progression#in', () => {
  it('materializes ii7–V7–Imaj7 in C major to Dm7, G7, Cmaj7', () => {
    const prog = Progression.create(['ii7', 'V7', 'Imaj7']);
    const result: ResolvedProgression = prog.in(Key.create('C', 'major'));

    expect(result.chords).toHaveLength(3);

    // ii7 → Dm7 (D minorSeventh)
    expect(result.chords[0]!.root.note).toBe('D');
    expect(result.chords[0]!.suffix).toBe('minorSeventh');

    // V7 → G7 (G dominantSeventh)
    expect(result.chords[1]!.root.note).toBe('G');
    expect(result.chords[1]!.suffix).toBe('dominantSeventh');

    // Imaj7 → Cmaj7 (C majorSeventh)
    expect(result.chords[2]!.root.note).toBe('C');
    expect(result.chords[2]!.suffix).toBe('majorSeventh');
  });

  it('materializes I–vi–IV–V in C major', () => {
    const prog = Progression.create(['I', 'vi', 'IV', 'V']);
    const result = prog.in(Key.create('C', 'major'));
    expect(result.chords[0]!.root.note).toBe('C');
    expect(result.chords[1]!.root.note).toBe('A');
    expect(result.chords[2]!.root.note).toBe('F');
    expect(result.chords[3]!.root.note).toBe('G');
  });

  it('materializes i–iv–V in A minor', () => {
    const prog = Progression.create(['i', 'iv', 'V']);
    const result = prog.in(Key.create('A', 'minor'));
    expect(result.chords[0]!.root.note).toBe('A');
    expect(result.chords[0]!.suffix).toBe('minor');
    expect(result.chords[1]!.root.note).toBe('D');
    expect(result.chords[1]!.suffix).toBe('minor');
    expect(result.chords[2]!.root.note).toBe('E');
    expect(result.chords[2]!.suffix).toBe('major');
  });

  it('materializes in G major', () => {
    const prog = Progression.create(['ii7', 'V7', 'I7']);
    const result = prog.in(Key.create('G', 'major'));
    expect(result.chords[0]!.root.note).toBe('A');
    expect(result.chords[0]!.suffix).toBe('minorSeventh');
    expect(result.chords[1]!.root.note).toBe('D');
    expect(result.chords[1]!.suffix).toBe('dominantSeventh');
    expect(result.chords[2]!.root.note).toBe('G');
    expect(result.chords[2]!.suffix).toBe('majorSeventh');
  });

  it('result has key, chords, and numerals', () => {
    const key = Key.create('C', 'major');
    const prog = Progression.create(['I', 'V']);
    const result = prog.in(key);
    expect(result.key).toBe(key);
    expect(result.numerals).toHaveLength(2);
    expect(result.chords).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Progression#toString and toStrings
// ---------------------------------------------------------------------------

describe('Progression toString methods', () => {
  it('toStrings returns array of numeral strings', () => {
    const prog = Progression.create(['ii', 'V', 'I']);
    const strings = prog.toStrings();
    expect(strings).toHaveLength(3);
    expect(strings[0]).toBe('ii');
    expect(strings[1]).toBe('V');
    expect(strings[2]).toBe('I');
  });

  it('toString joins numerals with en-dashes', () => {
    const prog = Progression.create(['ii', 'V', 'I']);
    expect(prog.toString()).toBe('ii – V – I');
  });

  it('[Symbol.toStringTag] includes Progression prefix', () => {
    const prog = Progression.create(['I', 'V']);
    expect(prog[Symbol.toStringTag]).toContain('Progression');
  });
});

// ---------------------------------------------------------------------------
// analyzeProgression
// ---------------------------------------------------------------------------

describe('analyzeProgression', () => {
  it('recovers ii7–V7–I from concrete Dm7, G7, C chords in C major', () => {
    const key = Key.create('C', 'major');
    const dm7 = chordFromRomanNumeral(key, 'ii7');
    const g7 = chordFromRomanNumeral(key, 'V7');
    const cMaj = chordFromRomanNumeral(key, 'I');

    const analysis: ProgressionAnalysis = analyzeProgression(key, [dm7, g7, cMaj]);
    expect(analysis.numerals).toHaveLength(3);
    expect(analysis.numerals[0]!.degree).toBe(2);
    expect(analysis.numerals[1]!.degree).toBe(5);
    expect(analysis.numerals[2]!.degree).toBe(1);
  });

  it('flags authentic cadence in V–I', () => {
    const key = Key.create('C', 'major');
    const g = chordFromRomanNumeral(key, 'V');
    const c = chordFromRomanNumeral(key, 'I');

    const analysis = analyzeProgression(key, [g, c]);
    const cadenceTypes = analysis.cadences.map((cad) => cad.type);
    expect(cadenceTypes).toContain('authentic-perfect');
  });

  it('flags authentic cadence in ii7–V7–I (V→I pair)', () => {
    const key = Key.create('C', 'major');
    const dm7 = chordFromRomanNumeral(key, 'ii7');
    const g7 = chordFromRomanNumeral(key, 'V7');
    const c = chordFromRomanNumeral(key, 'I');

    const analysis = analyzeProgression(key, [dm7, g7, c]);
    const cadenceTypes = analysis.cadences.map((cad) => cad.type);
    // V7→I is an authentic cadence
    expect(cadenceTypes.some((t) => t.startsWith('authentic'))).toBe(true);
  });

  it('accepts string numerals as input', () => {
    const key = Key.create('C', 'major');
    const analysis = analyzeProgression(key, ['ii', 'V', 'I']);
    expect(analysis.numerals).toHaveLength(3);
    expect(analysis.numerals[0]!.degree).toBe(2);
  });

  it('detects ii–V–I pattern', () => {
    const key = Key.create('C', 'major');
    const analysis = analyzeProgression(key, ['ii', 'V', 'I']);
    const patternNames = analysis.patterns.map((p) => p.name);
    expect(patternNames).toContain('ii–V–I');
  });

  it('detects I–vi–IV–V pattern', () => {
    const key = Key.create('C', 'major');
    const analysis = analyzeProgression(key, ['I', 'vi', 'IV', 'V']);
    const patternNames = analysis.patterns.map((p) => p.name);
    expect(patternNames).toContain('I–vi–IV–V');
  });

  it('detects I–vi–ii–V pattern', () => {
    const key = Key.create('C', 'major');
    const analysis = analyzeProgression(key, ['I', 'vi', 'ii', 'V']);
    const patternNames = analysis.patterns.map((p) => p.name);
    expect(patternNames).toContain('I–vi–ii–V');
  });

  it('works in A minor', () => {
    const key = Key.create('A', 'minor');
    const analysis = analyzeProgression(key, ['i', 'iv', 'V', 'i']);
    expect(analysis.numerals[0]!.degree).toBe(1);
    expect(analysis.numerals[0]!.quality).toBe('minor');
    expect(analysis.numerals[1]!.degree).toBe(4);
    expect(analysis.numerals[2]!.degree).toBe(5);
    expect(analysis.numerals[2]!.quality).toBe('major');
  });

  it('identifies borrowed bIII (Eb major in C major) as degree 3 major (♭III)', () => {
    const key = Key.create('C', 'major');
    const ebMaj = Chord.create('Eb', 'major');
    const analysis = analyzeProgression(key, [ebMaj]);
    expect(analysis.numerals).toHaveLength(1);
    const numeral = analysis.numerals[0]!;
    expect(numeral.degree).toBe(3);
    expect(numeral.quality).toBe('major');
    expect(numeral.toString()).toBe('♭III');
  });

  it('identifies concrete ii7–V7–I in C major with exact numeral strings', () => {
    const key = Key.create('C', 'major');
    const analysis = analyzeProgression(key, [
      Chord.create('D', 'minorSeventh'),
      Chord.create('G', 'dominantSeventh'),
      Chord.create('C', 'major'),
    ]);
    expect(analysis.numerals.map((n) => n.toString())).toEqual(['ii⁷', 'V⁷', 'I']);
    const cadenceTypes = analysis.cadences.map((c) => c.type);
    expect(cadenceTypes).toContain('authentic-perfect');
  });

  it('analysis result has key, numerals, cadences, patterns', () => {
    const key = Key.create('C', 'major');
    const analysis = analyzeProgression(key, ['I', 'V', 'I']);
    expect(analysis.key).toBe(key);
    expect(Array.isArray(analysis.numerals)).toBe(true);
    expect(Array.isArray(analysis.cadences)).toBe(true);
    expect(Array.isArray(analysis.patterns)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// suggestContinuations
// ---------------------------------------------------------------------------

describe('suggestContinuations', () => {
  it('after V suggests I as the first continuation (dominant resolution)', () => {
    const key = Key.create('C', 'major');
    const prog = Progression.create(['V']);
    const suggestions: readonly ProgressionContinuation[] = suggestContinuations(key, prog);

    expect(suggestions.length).toBeGreaterThan(0);
    const first = suggestions[0]!;
    expect(first.numeral.degree).toBe(1);
    expect(first.chord.root.note).toBe('C');
    expect(first.reason).toContain('Dominant resolves to tonic');
  });

  it('after I suggests IV as the first continuation', () => {
    const key = Key.create('C', 'major');
    const prog = Progression.create(['I']);
    const suggestions = suggestContinuations(key, prog);

    expect(suggestions.length).toBeGreaterThan(0);
    // First suggestion after I should be IV (subdominant)
    expect(suggestions[0]!.numeral.degree).toBe(4);
  });

  it('returns an empty array for an empty progression', () => {
    const key = Key.create('C', 'major');
    const prog = Progression.create([]);
    expect(suggestContinuations(key, prog)).toEqual([]);
  });

  it('respects maxSuggestions option', () => {
    const key = Key.create('C', 'major');
    const prog = Progression.create(['I']);
    const suggestions = suggestContinuations(key, prog, { maxSuggestions: 1 });
    expect(suggestions.length).toBe(1);
  });

  it('works in A minor key — after V suggests i', () => {
    const key = Key.create('A', 'minor');
    const prog = Progression.create(['V']);
    const suggestions = suggestContinuations(key, prog);
    expect(suggestions.length).toBeGreaterThan(0);
    const first = suggestions[0]!;
    expect(first.numeral.degree).toBe(1);
    expect(first.chord.root.note).toBe('A');
  });

  it('after vii° suggests I resolution', () => {
    const key = Key.create('C', 'major');
    const prog = Progression.create(['vii°']);
    const suggestions = suggestContinuations(key, prog);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.numeral.degree).toBe(1);
  });

  it('each suggestion has numeral, chord, and reason', () => {
    const key = Key.create('C', 'major');
    const prog = Progression.create(['ii']);
    const suggestions = suggestContinuations(key, prog);
    for (const s of suggestions) {
      expect(s.numeral).toBeDefined();
      expect(s.chord).toBeDefined();
      expect(typeof s.reason).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// detectModulations
// ---------------------------------------------------------------------------

describe('detectModulations', () => {
  it('detects V7/V as a modulation candidate to G major in C major', () => {
    const key = Key.create('C', 'major');
    // V7/V in C is D dominant, implying G major as a new key
    const prog = Progression.create(['I', 'V7/V', 'V', 'I']);
    const candidates: readonly ModulationCandidate[] = detectModulations(key, prog);

    expect(candidates.length).toBeGreaterThan(0);
    // The candidate at index 1 (V7/V) implies G major
    expect(candidates[0]!.startIndex).toBe(1);
    expect(candidates[0]!.toKey).toBe('G major');
    // V7/V followed by V → strong confidence
    expect(candidates[0]!.confidence).toBe('strong');
  });

  it('rates a lone V7/V without resolution as possible', () => {
    const key = Key.create('C', 'major');
    const prog = Progression.create(['I', 'V7/V', 'I']);
    const candidates = detectModulations(key, prog);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.confidence).toBe('possible');
  });

  it('filters to strong only when minConfidence is strong', () => {
    const key = Key.create('C', 'major');
    // V7/V without resolution (possible only)
    const prog = Progression.create(['I', 'V7/V', 'I']);
    const allCandidates = detectModulations(key, prog);
    const strongOnly = detectModulations(key, prog, { minConfidence: 'strong' });

    expect(allCandidates.length).toBeGreaterThan(0);
    expect(strongOnly.length).toBe(0);
  });

  it('returns empty for a progression with no applied chords', () => {
    const key = Key.create('C', 'major');
    const prog = Progression.create(['I', 'vi', 'IV', 'V']);
    const candidates = detectModulations(key, prog);
    expect(candidates).toHaveLength(0);
  });

  it('detects V/ii in C major implying D minor tonicization', () => {
    const key = Key.create('C', 'major');
    // V/ii = A major (dominant of D minor)
    const prog = Progression.create(['I', 'V/ii', 'ii', 'V', 'I']);
    const candidates = detectModulations(key, prog);
    const iiCandidate = candidates.find((c) => c.toKey === 'D minor');
    expect(iiCandidate).toBeDefined();
    expect(iiCandidate!.confidence).toBe('strong');
  });

  it('each candidate has startIndex, evidenceNumeral, toKey, confidence', () => {
    const key = Key.create('C', 'major');
    const prog = Progression.create(['V7/V', 'V', 'I']);
    const candidates = detectModulations(key, prog);
    for (const c of candidates) {
      expect(typeof c.startIndex).toBe('number');
      expect(c.evidenceNumeral).toBeDefined();
      expect(typeof c.toKey).toBe('string');
      expect(['strong', 'possible']).toContain(c.confidence);
    }
  });
});
