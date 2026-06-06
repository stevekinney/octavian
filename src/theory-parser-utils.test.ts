import { describe, expect, it } from 'bun:test';
import {
  normalizeScaleType,
  parseChordParts,
  parseKeyParts,
  parseScaleParts,
  splitLeadingRoot,
} from './theory-parser-utils.js';

// ---------------------------------------------------------------------------
// splitLeadingRoot
// ---------------------------------------------------------------------------

describe('splitLeadingRoot', () => {
  it('extracts a natural note', () => {
    const result = splitLeadingRoot('Cmaj7');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('C');
    expect(result!.rest).toBe('maj7');
  });

  it('extracts a sharp note', () => {
    const result = splitLeadingRoot('F#dim7');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('F#');
    expect(result!.rest).toBe('dim7');
  });

  it('extracts a flat note', () => {
    const result = splitLeadingRoot('Bbmaj7');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('Bb');
    expect(result!.rest).toBe('maj7');
  });

  it('extracts a double-sharp note', () => {
    const result = splitLeadingRoot('C## major');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('C##');
    expect(result!.rest).toBe(' major');
  });

  it('extracts a double-flat note', () => {
    const result = splitLeadingRoot('Dbb major');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('Dbb');
    expect(result!.rest).toBe(' major');
  });

  it('returns null for non-note start', () => {
    expect(splitLeadingRoot('major')).toBeNull();
    expect(splitLeadingRoot('')).toBeNull();
    expect(splitLeadingRoot('1C')).toBeNull();
  });

  it('extracts note leaving empty rest', () => {
    const result = splitLeadingRoot('C');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('C');
    expect(result!.rest).toBe('');
  });

  it('does not extract H (unsupported letter)', () => {
    expect(splitLeadingRoot('H major')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeScaleType
// ---------------------------------------------------------------------------

describe('normalizeScaleType', () => {
  it('passes through canonical camelCase types', () => {
    expect(normalizeScaleType('major')).toBe('major');
    expect(normalizeScaleType('melodicMinor')).toBe('melodicMinor');
    expect(normalizeScaleType('dorian')).toBe('dorian');
  });

  it('handles human-readable space-separated names', () => {
    expect(normalizeScaleType('natural minor')).toBe('naturalMinor');
    expect(normalizeScaleType('harmonic minor')).toBe('harmonicMinor');
    expect(normalizeScaleType('melodic minor')).toBe('melodicMinor');
    expect(normalizeScaleType('major pentatonic')).toBe('majorPentatonic');
    expect(normalizeScaleType('minor pentatonic')).toBe('minorPentatonic');
    expect(normalizeScaleType('whole tone')).toBe('wholeTone');
    expect(normalizeScaleType('half-whole diminished')).toBe('halfWholeDiminished');
  });

  it('is case-insensitive for human names', () => {
    expect(normalizeScaleType('Melodic Minor')).toBe('melodicMinor');
    expect(normalizeScaleType('MAJOR')).toBe('major');
  });

  it('resolves aliases', () => {
    expect(normalizeScaleType('minor')).toBe('naturalMinor');
    expect(normalizeScaleType('ionian')).toBe('major');
    expect(normalizeScaleType('aeolian')).toBe('naturalMinor');
  });

  it('throws TypeError for unknown type', () => {
    expect(() => normalizeScaleType('super locrian')).toThrow(TypeError);
    expect(() => normalizeScaleType('unknownScale')).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// parseChordParts
// ---------------------------------------------------------------------------

describe('parseChordParts', () => {
  it('parses a major triad', () => {
    const parts = parseChordParts('C');
    expect(parts.root).toBe('C');
    expect(parts.suffix).toBe('major');
    expect(parts.symbol).toBe('');
    expect(parts.bass).toBeNull();
  });

  it('parses a minor triad', () => {
    const parts = parseChordParts('Am');
    expect(parts.root).toBe('A');
    expect(parts.suffix).toBe('minor');
    expect(parts.symbol).toBe('m');
  });

  it('parses slash chord with bass note', () => {
    const parts = parseChordParts('Cmaj7/E');
    expect(parts.root).toBe('C');
    expect(parts.suffix).toBe('majorSeventh');
    expect(parts.bass).toBe('E');
  });

  it('parses Db chord', () => {
    const parts = parseChordParts('Db');
    expect(parts.root).toBe('Db');
    expect(parts.suffix).toBe('major');
  });

  it('throws TypeError for unknown root', () => {
    expect(() => parseChordParts('H')).toThrow(TypeError);
  });

  it('throws TypeError for unknown suffix', () => {
    expect(() => parseChordParts('Cxyz')).toThrow(TypeError);
  });

  it('throws TypeError for invalid bass note', () => {
    expect(() => parseChordParts('Cmaj7/H')).toThrow(TypeError);
  });

  it('throws TypeError for garbage after symbol (not a slash)', () => {
    expect(() => parseChordParts('Cmaj7X')).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// parseScaleParts
// ---------------------------------------------------------------------------

describe('parseScaleParts', () => {
  it('parses C major', () => {
    const parts = parseScaleParts('C major');
    expect(parts.root).toBe('C');
    expect(parts.type).toBe('major');
  });

  it('parses F# melodic minor', () => {
    const parts = parseScaleParts('F# melodic minor');
    expect(parts.root).toBe('F#');
    expect(parts.type).toBe('melodicMinor');
  });

  it('throws TypeError for unknown root', () => {
    expect(() => parseScaleParts('H major')).toThrow(TypeError);
  });

  it('throws TypeError for missing type', () => {
    expect(() => parseScaleParts('C')).toThrow(TypeError);
  });

  it('throws TypeError for unknown type', () => {
    expect(() => parseScaleParts('C super-dorian')).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// parseKeyParts
// ---------------------------------------------------------------------------

describe('parseKeyParts', () => {
  it('parses C major', () => {
    const parts = parseKeyParts('C major');
    expect(parts.root).toBe('C');
    expect(parts.mode).toBe('major');
  });

  it('parses F# minor', () => {
    const parts = parseKeyParts('F# minor');
    expect(parts.root).toBe('F#');
    expect(parts.mode).toBe('minor');
  });

  it('is case-insensitive for mode', () => {
    const parts = parseKeyParts('C Major');
    expect(parts.mode).toBe('major');
  });

  it('throws TypeError for unknown root', () => {
    expect(() => parseKeyParts('H major')).toThrow(TypeError);
  });

  it('throws TypeError for unsupported mode', () => {
    expect(() => parseKeyParts('C dorian')).toThrow(TypeError);
  });

  it('throws TypeError for missing mode', () => {
    expect(() => parseKeyParts('C')).toThrow(TypeError);
  });
});
