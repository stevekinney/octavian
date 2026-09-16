import { describe, expect, it } from 'vitest';
import { seededRandomInt } from './seeded-random.ts';

describe('seededRandomInt', () => {
	it('identical seed produces the same sequence on 100 repeated calls', () => {
		const a = seededRandomInt('same-seed');
		const b = seededRandomInt('same-seed');

		expect(Array.from({ length: 100 }, () => a(12))).toEqual(
			Array.from({ length: 100 }, () => b(12))
		);
	});

	it('different seeds produce different sequences within 5 calls', () => {
		const a = seededRandomInt('a');
		const b = seededRandomInt('b');

		expect(Array.from({ length: 5 }, () => a(12))).not.toEqual(
			Array.from({ length: 5 }, () => b(12))
		);
	});

	it('output is always in [0, count)', () => {
		for (const count of [1, 2, 12, 1000]) {
			const randomInt = seededRandomInt(`seed-${count}`);
			for (let index = 0; index < 100; index++) {
				const value = randomInt(count);
				expect(value).toBeGreaterThanOrEqual(0);
				expect(value).toBeLessThan(count);
			}
		}
	});

	it('successive calls return different values', () => {
		const randomInt = seededRandomInt('not-constant');
		const values = new Set(Array.from({ length: 20 }, () => randomInt(1000)));

		expect(values.size).toBeGreaterThan(1);
	});

	it('skip advances into the same deterministic stream', () => {
		const fullSequence = seededRandomInt('skip-seed');
		const skippedSequence = seededRandomInt('skip-seed', 12);
		Array.from({ length: 12 }, () => fullSequence(1000));

		expect(Array.from({ length: 8 }, () => skippedSequence(1000))).toEqual(
			Array.from({ length: 8 }, () => fullSequence(1000))
		);
	});
});
