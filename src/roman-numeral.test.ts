import { describe, expect, it } from 'bun:test';

import { RomanNumeral, type SerializedRomanNumeral } from './roman-numeral.js';

describe('RomanNumeral.parse — surface forms', () => {
  it('parses a simple major degree (I)', () => {
    const rn = RomanNumeral.parse('I');
    expect(rn.degree).toBe(1);
    expect(rn.quality).toBe('major');
    expect(rn.inversion).toBe('5/3');
    expect(rn.alteration).toBeUndefined();
    expect(rn.applied).toBeUndefined();
  });

  it('parses a simple minor degree (ii)', () => {
    const rn = RomanNumeral.parse('ii');
    expect(rn.degree).toBe(2);
    expect(rn.quality).toBe('minor');
  });

  it('parses diminished with ° marker', () => {
    const rn = RomanNumeral.parse('vii°');
    expect(rn.degree).toBe(7);
    expect(rn.quality).toBe('diminished');
  });

  it('parses ASCII diminished (lowercase o)', () => {
    expect(RomanNumeral.parse('viio').quality).toBe('diminished');
  });

  it('parses augmented with + marker', () => {
    const rn = RomanNumeral.parse('III+');
    expect(rn.degree).toBe(3);
    expect(rn.quality).toBe('augmented');
  });

  it('parses Unicode augmented marker (⁺)', () => {
    expect(RomanNumeral.parse('III⁺').quality).toBe('augmented');
  });

  it('rejects nonsensical case + marker combinations', () => {
    expect(() => RomanNumeral.parse('III°')).toThrow(TypeError); // uppercase + diminished
    expect(() => RomanNumeral.parse('iii+')).toThrow(TypeError); // lowercase + augmented
  });

  it('rejects unrecognized degree letters', () => {
    expect(() => RomanNumeral.parse('VIII')).toThrow(TypeError);
    expect(() => RomanNumeral.parse('Z')).toThrow(TypeError);
  });

  it('rejects an empty string', () => {
    expect(() => RomanNumeral.parse('')).toThrow(TypeError);
    expect(() => RomanNumeral.parse('   ')).toThrow(TypeError);
  });
});

describe('RomanNumeral.parse — degrees disambiguate longest-match-first', () => {
  it.each([
    ['I', 1],
    ['II', 2],
    ['III', 3],
    ['IV', 4],
    ['V', 5],
    ['VI', 6],
    ['VII', 7],
    ['i', 1],
    ['ii', 2],
    ['iii', 3],
    ['iv', 4],
    ['v', 5],
    ['vi', 6],
    ['vii', 7],
  ] as const)('parses %s as degree %d', (input: string, expected: number) => {
    expect(RomanNumeral.parse(input).degree).toBe(expected as RomanNumeral['degree']);
  });
});

describe('RomanNumeral.parse — alterations', () => {
  it('parses ASCII flat prefix (b)', () => {
    const rn = RomanNumeral.parse('bVII');
    expect(rn.alteration).toBe('flat');
    expect(rn.degree).toBe(7);
    expect(rn.quality).toBe('major');
  });

  it('parses ASCII sharp prefix (#)', () => {
    const rn = RomanNumeral.parse('#iv°');
    expect(rn.alteration).toBe('sharp');
    expect(rn.degree).toBe(4);
    expect(rn.quality).toBe('diminished');
  });

  it('parses Unicode flat prefix (♭)', () => {
    const rn = RomanNumeral.parse('♭III');
    expect(rn.alteration).toBe('flat');
    expect(rn.degree).toBe(3);
  });

  it('parses Unicode sharp prefix (♯)', () => {
    const rn = RomanNumeral.parse('♯iv°');
    expect(rn.alteration).toBe('sharp');
  });
});

describe('RomanNumeral.parse — inversions', () => {
  it.each([
    ['I', '5/3'],
    ['I6', '6'],
    ['I64', '6/4'],
    ['V7', '7'],
    ['V65', '6/5'],
    ['V43', '4/3'],
    ['V42', '4/2'],
  ] as const)(
    'parses %s with inversion %s',
    (input: string, expected: RomanNumeral['inversion']) => {
      expect(RomanNumeral.parse(input).inversion).toBe(expected);
    },
  );

  it('parses Unicode superscript inversions', () => {
    expect(RomanNumeral.parse('I⁶').inversion).toBe('6');
    expect(RomanNumeral.parse('V⁶₄').inversion).toBe('6/4');
    expect(RomanNumeral.parse('V⁷').inversion).toBe('7');
    expect(RomanNumeral.parse('V⁶₅').inversion).toBe('6/5');
    expect(RomanNumeral.parse('V⁴₃').inversion).toBe('4/3');
    expect(RomanNumeral.parse('V⁴₂').inversion).toBe('4/2');
  });

  it('rejects unrecognized inversion figures', () => {
    expect(() => RomanNumeral.parse('I33')).toThrow(TypeError);
    expect(() => RomanNumeral.parse('V8')).toThrow(TypeError);
  });
});

describe('RomanNumeral.parse — applied chords', () => {
  it('parses V/V', () => {
    const rn = RomanNumeral.parse('V/V');
    expect(rn.isApplied).toBe(true);
    expect(rn.degree).toBe(5);
    expect(rn.applied!.degree).toBe(5);
    expect(rn.applied!.quality).toBe('major');
  });

  it('parses V7/IV', () => {
    const rn = RomanNumeral.parse('V7/IV');
    expect(rn.degree).toBe(5);
    expect(rn.inversion).toBe('7');
    expect(rn.applied!.degree).toBe(4);
  });

  it('parses vii°/V', () => {
    const rn = RomanNumeral.parse('vii°/V');
    expect(rn.quality).toBe('diminished');
    expect(rn.applied!.degree).toBe(5);
  });

  it('rejects trailing slash', () => {
    expect(() => RomanNumeral.parse('V/')).toThrow(TypeError);
  });
});

describe('RomanNumeral round-trip', () => {
  const examples = [
    'I',
    'ii',
    'iii',
    'IV',
    'V',
    'vi',
    'vii°',
    'I⁶',
    'V⁷',
    'V⁶₅',
    'V⁴₃',
    'V⁴₂',
    'ii⁶',
    'IV⁶₄',
    '♭VII',
    '♭III',
    '♯iv°',
    'III⁺',
    'V⁷/V',
    'vii°/V',
    'V⁶₅/IV',
  ];

  it.each(examples)('parse → render round-trips for %s', (raw: string) => {
    const parsed = RomanNumeral.parse(raw);
    const rendered = parsed.toString();
    const reparsed = RomanNumeral.parse(rendered);
    expect(reparsed.equals(parsed)).toBe(true);
  });

  it('renders ASCII inputs in canonical Unicode form', () => {
    expect(RomanNumeral.parse('V7').toString()).toBe('V⁷');
    expect(RomanNumeral.parse('I6').toString()).toBe('I⁶');
    expect(RomanNumeral.parse('V64').toString()).toBe('V⁶₄');
    expect(RomanNumeral.parse('bVII').toString()).toBe('♭VII');
    expect(RomanNumeral.parse('III+').toString()).toBe('III⁺');
    expect(RomanNumeral.parse('V7/V').toString()).toBe('V⁷/V');
  });

  it.each(examples)('round-trips JSON for %s', (raw: string) => {
    const parsed = RomanNumeral.parse(raw);
    const restored = RomanNumeral.fromJSON(parsed.toJSON());
    expect(restored.equals(parsed)).toBe(true);
  });
});

describe('RomanNumeral.fromJSON validation', () => {
  it('rejects an out-of-range degree', () => {
    const bad = { degree: 99, quality: 'major', inversion: '5/3' };
    // Cast through unknown to feed the type-checker something the
    // public type doesn't allow.
    expect(() => RomanNumeral.fromJSON(bad as unknown as SerializedRomanNumeral)).toThrow(
      TypeError,
    );
  });

  it('rejects an unknown quality', () => {
    const bad = { degree: 1, quality: 'sus2', inversion: '5/3' };
    expect(() => RomanNumeral.fromJSON(bad as unknown as SerializedRomanNumeral)).toThrow(
      TypeError,
    );
  });

  it('rejects an unknown inversion', () => {
    const bad = { degree: 1, quality: 'major', inversion: '8/3' };
    expect(() => RomanNumeral.fromJSON(bad as unknown as SerializedRomanNumeral)).toThrow(
      TypeError,
    );
  });

  it('rejects an unknown alteration', () => {
    const bad = {
      degree: 1,
      quality: 'major',
      inversion: '5/3',
      alteration: 'doubleFlat',
    };
    expect(() => RomanNumeral.fromJSON(bad as unknown as SerializedRomanNumeral)).toThrow(
      TypeError,
    );
  });

  it('rejects bad nested applied target', () => {
    const bad = {
      degree: 5,
      quality: 'major',
      inversion: '5/3',
      applied: { degree: 99, quality: 'major', inversion: '5/3' },
    };
    expect(() => RomanNumeral.fromJSON(bad as unknown as SerializedRomanNumeral)).toThrow(
      TypeError,
    );
  });

  it('rejects applied: null (validation by presence, not truthiness)', () => {
    const bad = {
      degree: 5,
      quality: 'major',
      inversion: '5/3',
      applied: null,
    };
    expect(() => RomanNumeral.fromJSON(bad as unknown as SerializedRomanNumeral)).toThrow(
      TypeError,
    );
  });

  it('rejects applied: non-object (e.g., a string)', () => {
    const bad = {
      degree: 5,
      quality: 'major',
      inversion: '5/3',
      applied: 'V',
    };
    expect(() => RomanNumeral.fromJSON(bad as unknown as SerializedRomanNumeral)).toThrow(
      TypeError,
    );
  });

  it('treats applied: undefined the same as the property being absent', () => {
    // Both should produce a non-applied numeral; neither should throw.
    const a = RomanNumeral.fromJSON({ degree: 5, quality: 'major', inversion: '7' });
    const b = RomanNumeral.fromJSON({
      degree: 5,
      quality: 'major',
      inversion: '7',
      applied: undefined,
    });
    expect(a.equals(b)).toBe(true);
    expect(a.isApplied).toBe(false);
  });

  it('omits undefined fields from toJSON', () => {
    const snap = RomanNumeral.parse('I').toJSON();
    expect('alteration' in snap).toBe(false);
    expect('applied' in snap).toBe(false);
  });
});

describe('RomanNumeral.create', () => {
  it('returns the same instance when given a RomanNumeral', () => {
    const rn = RomanNumeral.parse('V7');
    expect(RomanNumeral.create(rn)).toBe(rn);
  });

  it('parses a string', () => {
    expect(RomanNumeral.create('IV').degree).toBe(4);
  });

  it('rebuilds from a serialized snapshot', () => {
    const snapshot: SerializedRomanNumeral = {
      degree: 5,
      quality: 'major',
      inversion: '7',
    };
    expect(RomanNumeral.create(snapshot).toString()).toBe('V⁷');
  });
});

describe('RomanNumeral.isRomanNumeral', () => {
  it('returns true for instances', () => {
    expect(RomanNumeral.isRomanNumeral(RomanNumeral.parse('I'))).toBe(true);
  });
  it('returns false for everything else', () => {
    expect(RomanNumeral.isRomanNumeral('I')).toBe(false);
    expect(RomanNumeral.isRomanNumeral({ degree: 1 })).toBe(false);
    expect(RomanNumeral.isRomanNumeral(null)).toBe(false);
  });
});

describe('RomanNumeral.equals', () => {
  it('returns true for identical numerals', () => {
    const a = RomanNumeral.parse('V7/V');
    const b = RomanNumeral.parse('V7/V');
    expect(a.equals(b)).toBe(true);
  });

  it('distinguishes by degree, quality, inversion, alteration, applied', () => {
    const base = RomanNumeral.parse('V7');
    expect(base.equals(RomanNumeral.parse('V'))).toBe(false); // inversion
    expect(base.equals(RomanNumeral.parse('vii°'))).toBe(false); // degree+quality
    expect(base.equals(RomanNumeral.parse('V7/V'))).toBe(false); // applied
    const flat = RomanNumeral.parse('♭VII');
    expect(flat.equals(RomanNumeral.parse('VII'))).toBe(false); // alteration
  });

  it('distinguishes applied targets that differ', () => {
    expect(RomanNumeral.parse('V/V').equals(RomanNumeral.parse('V/IV'))).toBe(false);
  });

  it('returns true when both numerals have the same applied target', () => {
    const a = RomanNumeral.parse('V7/V');
    const b = RomanNumeral.parse('V7/V');
    expect(a.equals(b)).toBe(true);
  });
});

describe('RomanNumeral.toString tag', () => {
  it('exposes a Symbol.toStringTag', () => {
    expect(Object.prototype.toString.call(RomanNumeral.parse('V7'))).toBe(
      '[object RomanNumeral(V⁷)]',
    );
  });
});
