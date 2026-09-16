import { describe, expect, it } from 'vitest';
import { EMPTY_SCORE, applyGuess, isScore, percent, type Score } from './scoring.ts';

describe('EMPTY_SCORE', () => {
	it('starts every counter at zero', () => {
		expect(EMPTY_SCORE).toEqual({ correct: 0, total: 0, streak: 0, best: 0 });
	});
});

describe('applyGuess', () => {
	it('increments correct, total, streak, and best on a correct guess', () => {
		expect(applyGuess(EMPTY_SCORE, true)).toEqual({ correct: 1, total: 1, streak: 1, best: 1 });
	});

	it('increments only total and resets streak on a wrong guess', () => {
		const score: Score = { correct: 3, total: 3, streak: 3, best: 3 };
		expect(applyGuess(score, false)).toEqual({ correct: 3, total: 4, streak: 0, best: 3 });
	});

	it('keeps best at the previous high after the streak resets', () => {
		let score = EMPTY_SCORE;
		score = applyGuess(score, true);
		score = applyGuess(score, true);
		score = applyGuess(score, false);
		expect(score).toEqual({ correct: 2, total: 3, streak: 0, best: 2 });
	});

	it('raises best only when the streak sets a new record', () => {
		let score: Score = { correct: 5, total: 8, streak: 1, best: 4 };
		score = applyGuess(score, true); // streak 2, best stays 4
		expect(score.best).toBe(4);
		score = applyGuess(score, true); // streak 3
		score = applyGuess(score, true); // streak 4
		score = applyGuess(score, true); // streak 5 → new best
		expect(score.streak).toBe(5);
		expect(score.best).toBe(5);
	});

	it('does not mutate the input score', () => {
		const score = { ...EMPTY_SCORE };
		applyGuess(score, true);
		expect(score).toEqual(EMPTY_SCORE);
	});
});

describe('percent', () => {
	it('is zero when no guesses have been made', () => {
		expect(percent(EMPTY_SCORE)).toBe(0);
	});

	it('computes a rounded accuracy percentage', () => {
		expect(percent({ correct: 1, total: 3, streak: 0, best: 1 })).toBe(33);
		expect(percent({ correct: 2, total: 3, streak: 0, best: 1 })).toBe(67);
	});

	it('reports 100 for a perfect score', () => {
		expect(percent({ correct: 4, total: 4, streak: 4, best: 4 })).toBe(100);
	});
});

describe('isScore', () => {
	it('accepts a well-formed score', () => {
		expect(isScore(EMPTY_SCORE)).toBe(true);
	});

	it('rejects non-objects', () => {
		expect(isScore(null)).toBe(false);
		expect(isScore(42)).toBe(false);
		expect(isScore('nope')).toBe(false);
	});

	it('rejects objects missing numeric fields', () => {
		expect(isScore({ correct: 1, total: 1, streak: 1 })).toBe(false);
		expect(isScore({ correct: '1', total: 1, streak: 1, best: 1 })).toBe(false);
	});
});
