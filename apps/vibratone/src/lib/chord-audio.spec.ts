import { describe, expect, it } from 'vitest';
import { normalizedChordGain } from './chord-audio.ts';

describe('normalizedChordGain', () => {
	it('reduces per-note gain as voices increase', () => {
		expect(normalizedChordGain(4)).toBeCloseTo(normalizedChordGain(1) / 2);
	});

	it('returns silence for an empty chord', () => {
		expect(normalizedChordGain(0)).toBe(0);
	});
});
