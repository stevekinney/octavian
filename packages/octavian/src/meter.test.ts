import { describe, expect, it } from 'bun:test';
import { Meter, metersEqual } from './meter.js';
import { createRational } from './rational.js';

describe('Meter.create with string', () => {
  it('parses 4/4', () => {
    const m = Meter.create('4/4');
    expect(m.numerator).toBe(4);
    expect(m.denominator).toBe(4);
  });

  it('parses 6/8', () => {
    const m = Meter.create('6/8');
    expect(m.numerator).toBe(6);
    expect(m.denominator).toBe(8);
  });

  it('parses 7/8', () => {
    const m = Meter.create('7/8');
    expect(m.numerator).toBe(7);
    expect(m.denominator).toBe(8);
  });

  it('throws TypeError for malformed string', () => {
    expect(() => Meter.create('44')).toThrow(TypeError);
  });

  it('throws TypeError for non-numeric string', () => {
    expect(() => Meter.create('x/y')).toThrow(TypeError);
  });

  it('throws TypeError for trailing garbage in numerator', () => {
    expect(() => Meter.create('4x/4')).toThrow(TypeError);
  });

  it('throws TypeError for trailing garbage in denominator', () => {
    expect(() => Meter.create('4/4x')).toThrow(TypeError);
  });
});

describe('Meter.create with numbers', () => {
  it('creates 4/4 from numbers', () => {
    const m = Meter.create(4, 4);
    expect(m.numerator).toBe(4);
    expect(m.denominator).toBe(4);
  });

  it('throws TypeError when denominator is omitted', () => {
    expect(() => Meter.create(4)).toThrow(TypeError);
  });

  it('throws RangeError for non-power-of-two denominator', () => {
    expect(() => Meter.create(4, 3)).toThrow(RangeError);
  });

  it('throws RangeError for zero numerator', () => {
    expect(() => Meter.create(0, 4)).toThrow(RangeError);
  });

  it('throws RangeError for negative numerator', () => {
    expect(() => Meter.create(-1, 4)).toThrow(RangeError);
  });
});

describe('simple meter (4/4)', () => {
  it('type is simple', () => {
    expect(Meter.create('4/4').type).toBe('simple');
  });

  it('isSimple() returns true', () => {
    expect(Meter.create('4/4').isSimple()).toBe(true);
  });

  it('isCompound() returns false', () => {
    expect(Meter.create('4/4').isCompound()).toBe(false);
  });

  it('beatsPerMeasure = 4', () => {
    expect(Meter.create('4/4').beatsPerMeasure).toBe(4);
  });

  it('beatUnit = 1/4 (quarter note)', () => {
    expect(Meter.create('4/4').beatUnit).toEqual({ numerator: 1, denominator: 4 });
  });

  it('measureDuration = 1 (whole note)', () => {
    expect(Meter.create('4/4').measureDuration).toEqual({ numerator: 1, denominator: 1 });
  });
});

describe('simple meter (3/4)', () => {
  it('type is simple (not compound)', () => {
    expect(Meter.create('3/4').type).toBe('simple');
  });

  it('beatsPerMeasure = 3', () => {
    expect(Meter.create('3/4').beatsPerMeasure).toBe(3);
  });

  it('measureDuration = 3/4', () => {
    expect(Meter.create('3/4').measureDuration).toEqual({ numerator: 3, denominator: 4 });
  });
});

describe('simple meter (3/8)', () => {
  it('type is simple (not compound)', () => {
    expect(Meter.create('3/8').type).toBe('simple');
  });

  it('beatsPerMeasure = 3', () => {
    expect(Meter.create('3/8').beatsPerMeasure).toBe(3);
  });
});

describe('compound meter (6/8)', () => {
  it('type is compound', () => {
    expect(Meter.create('6/8').type).toBe('compound');
  });

  it('isCompound() returns true', () => {
    expect(Meter.create('6/8').isCompound()).toBe(true);
  });

  it('isSimple() returns false', () => {
    expect(Meter.create('6/8').isSimple()).toBe(false);
  });

  it('beatsPerMeasure = 2', () => {
    expect(Meter.create('6/8').beatsPerMeasure).toBe(2);
  });

  it('beatUnit = 3/8 (dotted quarter)', () => {
    expect(Meter.create('6/8').beatUnit).toEqual({ numerator: 3, denominator: 8 });
  });

  it('measureDuration = 3/4', () => {
    // 6/8 = 6 eighth notes = 3 quarter notes = 3/4 whole note
    expect(Meter.create('6/8').measureDuration).toEqual({ numerator: 3, denominator: 4 });
  });
});

describe('compound meter (9/8)', () => {
  it('type is compound', () => {
    expect(Meter.create('9/8').type).toBe('compound');
  });

  it('beatsPerMeasure = 3', () => {
    expect(Meter.create('9/8').beatsPerMeasure).toBe(3);
  });
});

describe('compound meter (12/8)', () => {
  it('type is compound', () => {
    expect(Meter.create('12/8').type).toBe('compound');
  });

  it('beatsPerMeasure = 4', () => {
    expect(Meter.create('12/8').beatsPerMeasure).toBe(4);
  });
});

describe('asymmetric meter (7/8)', () => {
  it('type is asymmetric', () => {
    expect(Meter.create('7/8').type).toBe('asymmetric');
  });

  it('isAsymmetric() returns true', () => {
    expect(Meter.create('7/8').isAsymmetric()).toBe(true);
  });

  it('beatsPerMeasure = 7 (eighth-note pulses)', () => {
    expect(Meter.create('7/8').beatsPerMeasure).toBe(7);
  });

  it('beatUnit = 1/8', () => {
    expect(Meter.create('7/8').beatUnit).toEqual({ numerator: 1, denominator: 8 });
  });

  it('measureDuration = 7/8', () => {
    expect(Meter.create('7/8').measureDuration).toEqual({ numerator: 7, denominator: 8 });
  });
});

describe('asymmetric meter (5/4)', () => {
  it('type is asymmetric', () => {
    expect(Meter.create('5/4').type).toBe('asymmetric');
  });

  it('beatsPerMeasure = 5', () => {
    expect(Meter.create('5/4').beatsPerMeasure).toBe(5);
  });
});

describe('Meter.fitsExactly', () => {
  it('4 quarter notes fit 1 measure of 4/4', () => {
    const meter = Meter.create('4/4');
    expect(meter.fitsExactly(createRational(1, 1))).toBe(true);
  });

  it('8 quarter notes fit 2 measures of 4/4', () => {
    const meter = Meter.create('4/4');
    expect(meter.fitsExactly(createRational(2, 1))).toBe(true);
  });

  it('2 quarter notes do not fit an exact number of 4/4 measures', () => {
    const meter = Meter.create('4/4');
    expect(meter.fitsExactly(createRational(1, 2))).toBe(false);
  });

  it('6 eighth notes = 3/4 fit 1 measure of 6/8', () => {
    const meter = Meter.create('6/8');
    expect(meter.fitsExactly(createRational(3, 4))).toBe(true);
  });

  it('zero does not fit', () => {
    const meter = Meter.create('4/4');
    expect(meter.fitsExactly(createRational(0, 1))).toBe(false);
  });
});

describe('Meter.equals', () => {
  it('equal meters', () => {
    expect(Meter.create('4/4').equals(Meter.create('4/4'))).toBe(true);
  });

  it('different meters', () => {
    expect(Meter.create('4/4').equals(Meter.create('3/4'))).toBe(false);
  });
});

describe('Meter.toString and toStringTag', () => {
  it('toString returns the signature', () => {
    expect(Meter.create('4/4').toString()).toBe('4/4');
  });

  it('toStringTag', () => {
    expect(Meter.create('4/4')[Symbol.toStringTag]).toBe('Meter(4/4)');
  });
});

describe('Meter.toJSON and fromJSON', () => {
  it('round-trips 4/4', () => {
    const m = Meter.create('4/4');
    const restored = Meter.fromJSON(m.toJSON());
    expect(restored.equals(m)).toBe(true);
  });

  it('round-trips 6/8', () => {
    const m = Meter.create('6/8');
    const restored = Meter.fromJSON(m.toJSON());
    expect(restored.equals(m)).toBe(true);
  });
});

describe('metersEqual', () => {
  it('equal meters', () => {
    expect(metersEqual(Meter.create('4/4'), Meter.create('4/4'))).toBe(true);
  });

  it('different meters', () => {
    expect(metersEqual(Meter.create('4/4'), Meter.create('3/4'))).toBe(false);
  });

  it('3/4 and 6/8 have the same measure duration but are not equal', () => {
    // Both have measureDuration = 3/4 whole note, but different numerator/denominator.
    expect(metersEqual(Meter.create('3/4'), Meter.create('6/8'))).toBe(false);
  });
});
