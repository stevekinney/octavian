import { describe, expect, it } from 'vitest';
import { findVoicings, type VoicingSearch } from './chord-voicings';

const defaults: VoicingSearch = {
	chord: 'C',
	tuning: [40, 45, 50, 55, 59, 64],
	minFret: 0,
	maxFret: 3,
	maxFretSpan: 3,
	availableFingers: 4,
	allowBarres: true,
	allowOpen: true,
	allowMuted: true,
	omissions: 'none',
	bassPitchClass: null
};
describe('chord voicing searches', () => {
	it('includes the familiar open C and preserves all chord tones', () => {
		const shapes = [...findVoicings(defaults)];
		expect(shapes.some((shape) => JSON.stringify(shape.frets) === '[null,3,2,0,1,0]')).toBe(true);
		for (const shape of shapes)
			expect([...new Set(shape.midi.map((note) => note % 12))].sort((a, b) => a - b)).toEqual([
				0, 4, 7
			]);
	});
	it('filters inversions, open strings and muted strings independently', () => {
		const shapes = [
			...findVoicings({ ...defaults, maxFret: 5, allowOpen: false, bassPitchClass: 4 })
		];
		expect(shapes.length).toBeGreaterThan(0);
		for (const shape of shapes) {
			expect(shape.frets).not.toContain(0);
			expect(Math.min(...shape.midi) % 12).toBe(4);
		}
		const full = [...findVoicings({ ...defaults, allowMuted: false })];
		expect(full.length).toBeGreaterThan(0);
		expect(full.every((shape) => !shape.frets.includes(null))).toBe(true);
	});
	it('honors a custom tuning and slash bass', () => {
		const shapes = [
			...findVoicings({ ...defaults, chord: 'D/F#', tuning: [38, 45, 50, 55, 59, 64], maxFret: 4 })
		];
		expect(shapes.length).toBeGreaterThan(0);
		expect(shapes.every((shape) => Math.min(...shape.midi) % 12 === 6)).toBe(true);
	});
	it('rejects invalid bounds and tuning', () => {
		for (const override of [
			{ minFret: 5, maxFret: 2 },
			{ maxFret: 25 },
			{ tuning: [40] },
			{ tuning: [40, NaN] }
		]) {
			expect(() => [...findVoicings({ ...defaults, ...override })]).toThrow();
		}
	});
});
