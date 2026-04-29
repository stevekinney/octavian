import { describe, expect, it } from 'bun:test';

import {
  CIRCLE_OF_FIFTHS_MAJOR,
  CIRCLE_OF_FIFTHS_MINOR,
  adjacentKeys,
  circleOfFifths,
  distanceInFifths,
  enharmonicEquivalent,
  isOnCircleOfFifths,
} from './circle-of-fifths.js';
import { KEY_SIGNATURES } from './key-signature-catalog.js';

describe('CIRCLE_OF_FIFTHS_MAJOR', () => {
  it('contains exactly 12 entries', () => {
    expect(CIRCLE_OF_FIFTHS_MAJOR).toHaveLength(12);
  });

  it('starts at C major and ends at F major (counter-clockwise neighbor)', () => {
    expect(CIRCLE_OF_FIFTHS_MAJOR[0]).toBe(KEY_SIGNATURES['C-major']);
    expect(CIRCLE_OF_FIFTHS_MAJOR[11]).toBe(KEY_SIGNATURES['F-major']);
  });

  it('proceeds clockwise by perfect fifth (sharps side)', () => {
    expect(CIRCLE_OF_FIFTHS_MAJOR[1]).toBe(KEY_SIGNATURES['G-major']);
    expect(CIRCLE_OF_FIFTHS_MAJOR[2]).toBe(KEY_SIGNATURES['D-major']);
    expect(CIRCLE_OF_FIFTHS_MAJOR[3]).toBe(KEY_SIGNATURES['A-major']);
  });

  it('uses sharp form at the bottom (F# major, not Gb major)', () => {
    expect(CIRCLE_OF_FIFTHS_MAJOR[6]).toBe(KEY_SIGNATURES['F#-major']);
  });
});

describe('CIRCLE_OF_FIFTHS_MINOR', () => {
  it('contains exactly 12 entries', () => {
    expect(CIRCLE_OF_FIFTHS_MINOR).toHaveLength(12);
  });

  it('starts at A minor (relative of C major)', () => {
    expect(CIRCLE_OF_FIFTHS_MINOR[0]).toBe(KEY_SIGNATURES['A-minor']);
  });

  it('aligns each minor position with its relative major', () => {
    for (let index = 0; index < 12; index++) {
      const major = CIRCLE_OF_FIFTHS_MAJOR[index]!;
      const minor = CIRCLE_OF_FIFTHS_MINOR[index]!;
      expect(major.accidentalCount).toBe(minor.accidentalCount);
      expect(major.order).toBe(minor.order);
    }
  });
});

describe('circleOfFifths()', () => {
  it('returns the major circle by default', () => {
    expect(circleOfFifths()).toBe(CIRCLE_OF_FIFTHS_MAJOR);
  });

  it('returns the major circle when mode is "major"', () => {
    expect(circleOfFifths('major')).toBe(CIRCLE_OF_FIFTHS_MAJOR);
  });

  it('returns the minor circle when mode is "minor"', () => {
    expect(circleOfFifths('minor')).toBe(CIRCLE_OF_FIFTHS_MINOR);
  });
});

describe('distanceInFifths', () => {
  it('returns 0 for the same key', () => {
    expect(distanceInFifths(KEY_SIGNATURES['C-major'], KEY_SIGNATURES['C-major'])).toBe(0);
  });

  it('returns +1 for the dominant of a key', () => {
    expect(distanceInFifths(KEY_SIGNATURES['C-major'], KEY_SIGNATURES['G-major'])).toBe(1);
    expect(distanceInFifths(KEY_SIGNATURES['G-major'], KEY_SIGNATURES['D-major'])).toBe(1);
  });

  it('returns -1 for the subdominant of a key', () => {
    expect(distanceInFifths(KEY_SIGNATURES['C-major'], KEY_SIGNATURES['F-major'])).toBe(-1);
    expect(distanceInFifths(KEY_SIGNATURES['G-major'], KEY_SIGNATURES['C-major'])).toBe(-1);
  });

  it('returns the shortest signed distance, wrapping around the circle', () => {
    // B (5 sharps) → F# (6 sharps): +1, not -11.
    expect(distanceInFifths(KEY_SIGNATURES['B-major'], KEY_SIGNATURES['F#-major'])).toBe(1);
    // F# (index 6) → F (index 11): clockwise 5 steps through Db/Ab/Eb/Bb,
    // counter-clockwise 7 steps. Result is +5 (the shorter direction).
    expect(distanceInFifths(KEY_SIGNATURES['F#-major'], KEY_SIGNATURES['F-major'])).toBe(5);
    // Direction is reversible: F → F# is also 5 (both are 5 steps apart on
    // the circle), but with the +/− sign convention, F → F# is -5.
    expect(distanceInFifths(KEY_SIGNATURES['F-major'], KEY_SIGNATURES['F#-major'])).toBe(-5);
  });

  it('uses negative when the destination is more than 6 positions clockwise', () => {
    // C (index 0) → F#-Gb diametric (index 6): exactly 6 fifths.
    expect(distanceInFifths(KEY_SIGNATURES['C-major'], KEY_SIGNATURES['F#-major'])).toBe(6);
    // C (index 0) → Db (index 7): clockwise 7 steps OR counter-clockwise 5.
    // Shorter direction is counter-clockwise → -5.
    expect(distanceInFifths(KEY_SIGNATURES['C-major'], KEY_SIGNATURES['Db-major'])).toBe(-5);
  });

  it('wraps to positive when the raw delta is less than -6', () => {
    // F (index 11) → G (index 1): raw delta = -10, wrapped to +2.
    expect(distanceInFifths(KEY_SIGNATURES['F-major'], KEY_SIGNATURES['G-major'])).toBe(2);
    // Bb (index 10) → D (index 2): raw delta = -8, wrapped to +4.
    expect(distanceInFifths(KEY_SIGNATURES['Bb-major'], KEY_SIGNATURES['D-major'])).toBe(4);
  });

  it('handles minor-to-minor distances independently of major', () => {
    expect(distanceInFifths(KEY_SIGNATURES['A-minor'], KEY_SIGNATURES['E-minor'])).toBe(1);
    expect(distanceInFifths(KEY_SIGNATURES['A-minor'], KEY_SIGNATURES['D-minor'])).toBe(-1);
  });

  it('throws TypeError when the modes differ', () => {
    expect(() => distanceInFifths(KEY_SIGNATURES['C-major'], KEY_SIGNATURES['A-minor'])).toThrow(
      TypeError,
    );
  });

  it('resolves theoretical/enharmonic spellings to their cardinal position', () => {
    // Cb-major is enharmonic to B-major; B-major is at index 5.
    expect(distanceInFifths(KEY_SIGNATURES['C-major'], KEY_SIGNATURES['Cb-major'])).toBe(5);
  });

  it('throws RangeError for keys not on the circle and without enharmonic equivalent', () => {
    // G#-major is theoretical and has no standard enharmonic at a cardinal
    // position (Ab-major is at a cardinal position, but the catalog's
    // ENHARMONIC_PAIRS deliberately omits the > 7-accidental theoretical
    // keys to keep the relation symmetric and unambiguous).
    expect(() => distanceInFifths(KEY_SIGNATURES['G#-major'], KEY_SIGNATURES['C-major'])).toThrow(
      RangeError,
    );
  });
});

describe('adjacentKeys', () => {
  it('returns the dominant and subdominant of a major key', () => {
    const adjacent = adjacentKeys(KEY_SIGNATURES['C-major']);
    expect(adjacent.dominant).toBe(KEY_SIGNATURES['G-major']);
    expect(adjacent.subdominant).toBe(KEY_SIGNATURES['F-major']);
  });

  it('returns the dominant and subdominant of a minor key', () => {
    const adjacent = adjacentKeys(KEY_SIGNATURES['A-minor']);
    expect(adjacent.dominant).toBe(KEY_SIGNATURES['E-minor']);
    expect(adjacent.subdominant).toBe(KEY_SIGNATURES['D-minor']);
  });

  it('wraps around at the bottom of the circle', () => {
    // F-major's clockwise neighbor wraps to C-major
    const adjacent = adjacentKeys(KEY_SIGNATURES['F-major']);
    expect(adjacent.dominant).toBe(KEY_SIGNATURES['C-major']);
    // F-major's counter-clockwise neighbor is Bb-major
    expect(adjacent.subdominant).toBe(KEY_SIGNATURES['Bb-major']);
  });

  it('wraps around through the F# / Gb seam', () => {
    // F# major's clockwise neighbor is Db major (the next entry on the circle).
    const adjacent = adjacentKeys(KEY_SIGNATURES['F#-major']);
    expect(adjacent.dominant).toBe(KEY_SIGNATURES['Db-major']);
    expect(adjacent.subdominant).toBe(KEY_SIGNATURES['B-major']);
  });

  it('preserves flat-side spelling for Db major (spelling-correct subdominant Gb-major)', () => {
    // Cardinal-path subdominant would be index 6 = F#-major (wrong spelling
    // family for Db). Per-direction override fixes it to Gb-major.
    const adjacent = adjacentKeys(KEY_SIGNATURES['Db-major']);
    expect(adjacent.dominant).toBe(KEY_SIGNATURES['Ab-major']);
    expect(adjacent.subdominant).toBe(KEY_SIGNATURES['Gb-major']);
  });

  it('preserves flat-side spelling for Gb major (Db / Cb neighbors)', () => {
    const adjacent = adjacentKeys(KEY_SIGNATURES['Gb-major']);
    expect(adjacent.dominant).toBe(KEY_SIGNATURES['Db-major']);
    expect(adjacent.subdominant).toBe(KEY_SIGNATURES['Cb-major']);
  });

  it('preserves flat-side spelling for Eb minor (Bb / Ab minor neighbors)', () => {
    const adjacent = adjacentKeys(KEY_SIGNATURES['Eb-minor']);
    expect(adjacent.dominant).toBe(KEY_SIGNATURES['Bb-minor']);
    expect(adjacent.subdominant).toBe(KEY_SIGNATURES['Ab-minor']);
  });

  it('preserves spelling per-direction independently (Cb dominant override; subdominant cardinal)', () => {
    // Cb-major's spelling-preserving dominant is the standard Gb-major,
    // so the dominant override applies. The spelling-preserving
    // subdominant would be the theoretical Fb-major, so subdominant
    // falls through to the cardinal path (E-major via the Cb-major
    // ↔ B-major enharmonic resolution).
    const adjacent = adjacentKeys(KEY_SIGNATURES['Cb-major']);
    expect(adjacent.dominant).toBe(KEY_SIGNATURES['Gb-major']);
    expect(adjacent.subdominant).toBe(KEY_SIGNATURES['E-major']);
  });

  it('preserves spelling per-direction for C# major (subdominant override; dominant cardinal)', () => {
    // C#-major's spelling-preserving dominant would be theoretical
    // G#-major, so dominant falls through to cardinal (Ab-major via
    // C#-major ↔ Db-major). Subdominant Override → F#-major (standard).
    const adjacent = adjacentKeys(KEY_SIGNATURES['C#-major']);
    expect(adjacent.dominant).toBe(KEY_SIGNATURES['Ab-major']);
    expect(adjacent.subdominant).toBe(KEY_SIGNATURES['F#-major']);
  });
});

describe('enharmonicEquivalent', () => {
  it('returns the flat-side spelling for a sharp-side key', () => {
    expect(enharmonicEquivalent(KEY_SIGNATURES['F#-major'])).toBe(KEY_SIGNATURES['Gb-major']);
  });

  it('returns the sharp-side spelling for a flat-side key', () => {
    expect(enharmonicEquivalent(KEY_SIGNATURES['Gb-major'])).toBe(KEY_SIGNATURES['F#-major']);
    expect(enharmonicEquivalent(KEY_SIGNATURES['Cb-major'])).toBe(KEY_SIGNATURES['B-major']);
  });

  it('handles enharmonic minor keys (D#/Eb minor, G#/Ab minor, A#/Bb minor)', () => {
    expect(enharmonicEquivalent(KEY_SIGNATURES['D#-minor'])).toBe(KEY_SIGNATURES['Eb-minor']);
    expect(enharmonicEquivalent(KEY_SIGNATURES['G#-minor'])).toBe(KEY_SIGNATURES['Ab-minor']);
    expect(enharmonicEquivalent(KEY_SIGNATURES['A#-minor'])).toBe(KEY_SIGNATURES['Bb-minor']);
  });

  it('returns null for keys with no standard enharmonic equivalent', () => {
    expect(enharmonicEquivalent(KEY_SIGNATURES['C-major'])).toBeNull();
    expect(enharmonicEquivalent(KEY_SIGNATURES['G-major'])).toBeNull();
    expect(enharmonicEquivalent(KEY_SIGNATURES['A-minor'])).toBeNull();
  });
});

describe('isOnCircleOfFifths', () => {
  it('returns true for cardinal positions', () => {
    expect(isOnCircleOfFifths('C', 'major')).toBe(true);
    expect(isOnCircleOfFifths('F#', 'major')).toBe(true);
    expect(isOnCircleOfFifths('A', 'minor')).toBe(true);
  });

  it('returns true for enharmonic equivalents at the bottom', () => {
    expect(isOnCircleOfFifths('Gb', 'major')).toBe(true);
    expect(isOnCircleOfFifths('Cb', 'major')).toBe(true);
    expect(isOnCircleOfFifths('D#', 'minor')).toBe(true);
  });

  it('returns false for theoretical keys outside the standard 12+enharmonics', () => {
    expect(isOnCircleOfFifths('G#', 'major')).toBe(false);
    expect(isOnCircleOfFifths('Fb', 'major')).toBe(false);
  });
});
