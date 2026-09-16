import { describe, expect, it } from 'vitest';
import {
	TUNINGS,
	allPositions,
	eligiblePositions,
	notationKey,
	parseTuning,
	pickPosition
} from './fretboard.ts';

describe('fretboard model', () => {
	it('contains the expected low-to-high tuning presets', () => {
		expect(TUNINGS).toEqual([
			{ id: 'standard', label: 'Standard', notes: [40, 45, 50, 55, 59, 64] },
			{ id: 'halfStepDown', label: 'Half Step Down', notes: [39, 44, 49, 54, 58, 63] },
			{ id: 'wholeStepDown', label: 'Whole Step Down', notes: [38, 43, 48, 53, 57, 62] },
			{ id: 'dropD', label: 'Drop D', notes: [38, 45, 50, 55, 59, 64] },
			{ id: 'dropC', label: 'Drop C', notes: [36, 43, 50, 55, 59, 64] },
			{ id: 'openD', label: 'Open D', notes: [38, 45, 50, 54, 57, 62] },
			{ id: 'openE', label: 'Open E', notes: [40, 47, 52, 56, 59, 64] },
			{ id: 'DADGAD', label: 'DADGAD', notes: [38, 45, 50, 55, 57, 62] },
			{ id: 'openG', label: 'Open G', notes: [38, 43, 50, 55, 59, 62] }
		]);
	});

	it('builds open strings and fretted MIDI notes', () => {
		const positions = allPositions(TUNINGS[0].notes, 21);
		expect(positions).toHaveLength(6 * 22);
		expect(positions[0]).toEqual({ stringIndex: 0, fret: 0, midi: 40 });
		expect(positions.at(-1)).toEqual({ stringIndex: 5, fret: 21, midi: 85 });
	});

	it('filters eligible notes by pitch class across octaves', () => {
		const positions = eligiblePositions([40, 45], 24, [4]).filter(
			({ stringIndex }) => stringIndex === 0
		);
		expect(positions.map(({ fret }) => fret)).toEqual([0, 12, 24]);
	});

	it('filters eligible positions by octave, string, and fret scope', () => {
		const positions = eligiblePositions([40, 45], 24, [4], {
			octaveLo: 2,
			octaveHi: 3,
			stringIndices: [0],
			fretLo: 1,
			fretHi: 20
		});
		expect(positions).toEqual([{ stringIndex: 0, fret: 12, midi: 52 }]);
	});

	it('applies each scope bound inclusively and returns no matches when scopes do not overlap', () => {
		expect(
			eligiblePositions([40], 24, [4], { octaveLo: 3, octaveHi: 3 }).map(({ fret }) => fret)
		).toEqual([12]);
		expect(
			eligiblePositions([40], 24, [4], { fretLo: 12, fretHi: 12 }).map(({ fret }) => fret)
		).toEqual([12]);
		expect(
			eligiblePositions([40, 45], 24, [4], { stringIndices: [1], fretLo: 0, fretHi: 0 })
		).toEqual([]);
		expect(eligiblePositions([40], 24, [4], { octaveLo: 5 })).toEqual([]);
	});

	it('filters by multiple selected strings, including nonadjacent strings', () => {
		const positions = eligiblePositions([40, 45, 50, 55], 21, [2, 4], {
			stringIndices: [0, 2],
			fretLo: 0,
			fretHi: 0
		});
		expect(positions).toEqual([
			{ stringIndex: 0, fret: 0, midi: 40 },
			{ stringIndex: 2, fret: 0, midi: 50 }
		]);
	});

	it('returns no matches for an explicitly empty string scope', () => {
		expect(eligiblePositions([40, 45], 24, [4], { stringIndices: [] })).toEqual([]);
	});

	it('picks uniformly by the injected draw and permits repeats', () => {
		const positions = allPositions([40], 21).slice(0, 3);
		const first = pickPosition(positions, () => 0);
		const repeated = pickPosition(positions, () => 0);
		expect(first).toBe(repeated);
		expect(pickPosition(positions, () => 0.999)?.fret).toBe(2);
		expect(pickPosition([], () => 0)).toBeNull();
	});

	it('parses and validates custom scientific-pitch tunings', () => {
		expect(parseTuning('E2 A2 D3 G3 B3 E4')).toEqual([40, 45, 50, 55, 59, 64]);
		expect(parseTuning('C#2 D♭2')).toEqual([37, 37]);
		expect(parseTuning('E2')).toBeNull();
		expect(parseTuning('E2 A2 H2')).toBeNull();
		expect(parseTuning('E2 A2 D3 G3 B3 E4 F5 G6 A7')).toBeNull();
		expect(parseTuning('C-2 D2')).toBeNull();
	});

	it('spells notation with key-aware accidentals and correct octaves', () => {
		expect(notationKey(61, 'C')).toBe('c#/4');
		expect(notationKey(61, 'Db')).toBe('db/4');
		expect(notationKey(65, 'B')).toBe('f/4');
		expect(notationKey(60, 'Db')).toBe('c/4');
		expect(notationKey(64, 'chromatic')).toBe('e/4');
	});
});
