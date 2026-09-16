import { describe, expect, it } from 'vitest';
import {
	BLACK_PITCH_CLASSES,
	FLAT_NAMES,
	KEYS,
	MODES,
	MAJOR_SCALE_INTERVALS,
	ROOT_KEYS,
	SHARP_NAMES,
	WHITE_PITCH_CLASSES,
	bothSpellings,
	formatPitch,
	isBlackPitchClass,
	keyById,
	majorScalePitchClasses,
	noteLabel,
	normalizePitchClass,
	pitchToFrequency,
	pitchToMidi,
	scalePitchClassSet,
	type ModeName,
	type KeyDefinition
} from './music.ts';

describe('spelling tables', () => {
	it('has twelve sharp and twelve flat names', () => {
		expect(SHARP_NAMES).toHaveLength(12);
		expect(FLAT_NAMES).toHaveLength(12);
	});

	it('spells naturals identically in both tables', () => {
		for (const pc of WHITE_PITCH_CLASSES) {
			expect(SHARP_NAMES[pc]).toBe(FLAT_NAMES[pc]);
		}
	});

	it('spells black keys with sharps and flats respectively', () => {
		expect(SHARP_NAMES[1]).toBe('C♯');
		expect(FLAT_NAMES[1]).toBe('D♭');
		expect(SHARP_NAMES[10]).toBe('A♯');
		expect(FLAT_NAMES[10]).toBe('B♭');
	});
});

describe('normalizePitchClass', () => {
	it('passes through in-range values', () => {
		expect(normalizePitchClass(0)).toBe(0);
		expect(normalizePitchClass(11)).toBe(11);
	});

	it('wraps values above the range', () => {
		expect(normalizePitchClass(12)).toBe(0);
		expect(normalizePitchClass(13)).toBe(1);
	});

	it('wraps negative values', () => {
		expect(normalizePitchClass(-1)).toBe(11);
		expect(normalizePitchClass(-12)).toBe(0);
	});

	it('truncates fractional values before wrapping', () => {
		expect(normalizePitchClass(2.9)).toBe(2);
	});
});

describe('black pitch classes', () => {
	it('contains exactly the five accidentals', () => {
		expect([...BLACK_PITCH_CLASSES].sort((a, b) => a - b)).toEqual([1, 3, 6, 8, 10]);
	});

	it('classifies white and black keys', () => {
		expect(isBlackPitchClass(1)).toBe(true);
		expect(isBlackPitchClass(0)).toBe(false);
		expect(isBlackPitchClass(11)).toBe(false);
	});

	it('normalizes before classifying', () => {
		expect(isBlackPitchClass(13)).toBe(true); // 13 → 1
		expect(isBlackPitchClass(12)).toBe(false); // 12 → 0
	});
});

describe('keyById', () => {
	it('returns the chromatic key first in the registry', () => {
		expect(KEYS[0].id).toBe('chromatic');
		expect(KEYS[0].tonicPc).toBeNull();
	});

	it('offers twelve roots and all modal definitions', () => {
		expect(ROOT_KEYS).toHaveLength(13);
		expect(KEYS).toHaveLength(1 + 12 * MODES.length);
	});

	it('finds a known key by id', () => {
		expect(keyById('Bb').label).toBe('B♭ Major');
		expect(keyById('G').tonicPc).toBe(7);
	});

	it('falls back to chromatic for an unknown id', () => {
		expect(keyById('does-not-exist').id).toBe('chromatic');
	});

	it('assigns sharp keys sharp spelling and flat keys flat spelling', () => {
		expect(keyById('D').spelling).toBe('sharp');
		expect(keyById('F').spelling).toBe('flat');
		expect(keyById('C').spelling).toBe('sharp');
	});

	it('parses persisted modal IDs and exposes their parent signatures', () => {
		expect(keyById('C:dorian')).toMatchObject({ mode: 'dorian', tonicPc: 0, signature: 'Bb' });
		expect(keyById('A:aeolian')).toMatchObject({ mode: 'aeolian', tonicPc: 9, signature: 'C' });
		expect(keyById('F#').signature).toBe('F#');
	});
});

describe('majorScalePitchClasses', () => {
	it('uses the canonical major interval pattern', () => {
		expect(MAJOR_SCALE_INTERVALS).toEqual([0, 2, 4, 5, 7, 9, 11]);
	});

	it('builds C major as the seven white keys', () => {
		expect(majorScalePitchClasses(0)).toEqual([0, 2, 4, 5, 7, 9, 11]);
	});

	it('builds G major (one sharp: F♯)', () => {
		expect(majorScalePitchClasses(7)).toEqual([7, 9, 11, 0, 2, 4, 6]);
	});

	it('builds F major (one flat: B♭)', () => {
		expect(majorScalePitchClasses(5)).toEqual([5, 7, 9, 10, 0, 2, 4]);
	});

	it('wraps the tonic into range first', () => {
		expect(majorScalePitchClasses(12)).toEqual(majorScalePitchClasses(0));
	});
});

describe('scalePitchClassSet', () => {
	it('returns all twelve pitch classes for chromatic', () => {
		const chromatic = KEYS[0];
		expect(scalePitchClassSet(chromatic).size).toBe(12);
	});

	it('returns the seven diatonic notes for a major key', () => {
		const set = scalePitchClassSet(keyById('D'));
		expect(set.size).toBe(7);
		expect([...set].sort((a, b) => a - b)).toEqual([1, 2, 4, 6, 7, 9, 11]);
	});

	it('uses Octavian mode scales for Dorian and Aeolian', () => {
		expect([...scalePitchClassSet(keyById('C:dorian'))].sort((a, b) => a - b)).toEqual([
			0, 2, 3, 5, 7, 9, 10
		]);
		expect([...scalePitchClassSet(keyById('A:aeolian'))].sort((a, b) => a - b)).toEqual([
			0, 2, 4, 5, 7, 9, 11
		]);
	});

	it('keeps major as the identity mode for existing IDs', () => {
		const major = keyById('C');
		expect(major.mode satisfies ModeName).toBe('major');
		expect(keyById('C:major')).toEqual(major);
	});
});

describe('noteLabel and bothSpellings', () => {
	it('labels a black key by the requested spelling', () => {
		expect(noteLabel(1, 'sharp')).toBe('C♯');
		expect(noteLabel(1, 'flat')).toBe('D♭');
	});

	it('treats "both" as sharp for a single label', () => {
		expect(noteLabel(1, 'both')).toBe('C♯');
	});

	it('returns both enharmonic spellings, sharp first', () => {
		expect(bothSpellings(1)).toEqual(['C♯', 'D♭']);
	});

	it('returns identical spellings for natural notes', () => {
		expect(bothSpellings(0)).toEqual(['C', 'C']);
	});
});

describe('pitchToMidi and pitchToFrequency', () => {
	it('places middle C at MIDI 60', () => {
		expect(pitchToMidi({ pc: 0, octave: 4 })).toBe(60);
	});

	it('places concert A at MIDI 69', () => {
		expect(pitchToMidi({ pc: 9, octave: 4 })).toBe(69);
	});

	it('tunes concert A to 440 Hz exactly', () => {
		expect(pitchToFrequency({ pc: 9, octave: 4 })).toBeCloseTo(440, 6);
	});

	it('tunes middle C to ~261.63 Hz', () => {
		expect(pitchToFrequency({ pc: 0, octave: 4 })).toBeCloseTo(261.6256, 3);
	});

	it('doubles frequency across an octave', () => {
		const low = pitchToFrequency({ pc: 0, octave: 3 });
		const high = pitchToFrequency({ pc: 0, octave: 4 });
		expect(high / low).toBeCloseTo(2, 6);
	});
});

describe('formatPitch', () => {
	it('renders a black-key pitch with octave under sharp spelling', () => {
		expect(formatPitch({ pc: 1, octave: 4 }, 'sharp')).toBe('C♯4');
	});

	it('renders the same pitch with flat spelling', () => {
		expect(formatPitch({ pc: 1, octave: 4 }, 'flat')).toBe('D♭4');
	});
});

describe('KeyDefinition shape', () => {
	it('exposes the fields the UI consumes', () => {
		const key: KeyDefinition = keyById('Bb');
		expect(key).toMatchObject({ id: 'Bb', short: 'B♭', tonicPc: 10, spelling: 'flat' });
	});
});
