import { describe, expect, it } from 'vitest';
import {
	createSavedTuning,
	loadSavedTunings,
	readSavedTunings,
	removeSavedTuning,
	saveSavedTunings,
	TUNING_STORAGE_KEY,
	updateSavedTuning
} from './tuning-storage';

function storage(initial: Record<string, string> = {}): Storage {
	const values = new Map(Object.entries(initial));
	return {
		get length() {
			return values.size;
		},
		clear: () => values.clear(),
		getItem: (key) => values.get(key) ?? null,
		key: (index) => [...values.keys()][index] ?? null,
		removeItem: (key) => void values.delete(key),
		setItem: (key, value) => void values.set(key, value)
	} satisfies Storage;
}

const notes = [40, 45, 50, 55, 59, 64];

describe('tuning storage', () => {
	it('round-trips saved tuning CRUD', () => {
		const target = storage();
		const created = createSavedTuning('Studio', notes, target);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		expect(loadSavedTunings(target)).toEqual([created.value]);
		const updated = updateSavedTuning(
			created.value.id,
			'Drop setup',
			[38, 45, 50, 55, 59, 64],
			target
		);
		expect(updated).toEqual({
			ok: true,
			value: { id: created.value.id, name: 'Drop setup', notes: [38, 45, 50, 55, 59, 64] }
		});
		expect(removeSavedTuning(created.value.id, target)).toEqual({ ok: true, value: [] });
	});

	it('rejects malformed notes and names', () => {
		const target = storage();
		expect(createSavedTuning('', notes, target).ok).toBe(false);
		expect(createSavedTuning('Bad', [40], target).ok).toBe(false);
		expect(createSavedTuning('Bad', [40, 45.5], target).ok).toBe(false);
	});

	it('leaves malformed stored data untouched and reports it', () => {
		const target = storage({ [TUNING_STORAGE_KEY]: '{broken' });
		expect(loadSavedTunings(target)).toEqual([]);
		expect(readSavedTunings(target).ok).toBe(false);
		expect(createSavedTuning('New', notes, target).ok).toBe(false);
		expect(target.getItem(TUNING_STORAGE_KEY)).toBe('{broken');
	});

	it('reports blocked writes without changing saved tunings', () => {
		const target = storage();
		const created = createSavedTuning('Original', notes, target);
		expect(created.ok).toBe(true);
		if (!created.ok) throw new Error('Creation failed');
		target.setItem = () => {
			throw new DOMException('Quota exceeded', 'QuotaExceededError');
		};
		expect(createSavedTuning('New', notes, target).ok).toBe(false);
		expect(updateSavedTuning(created.value.id, 'Changed', [38, 45], target).ok).toBe(false);
		expect(removeSavedTuning(created.value.id, target).ok).toBe(false);
		expect(loadSavedTunings(target)).toEqual([created.value]);
		expect(createSavedTuning('Unavailable', notes, null).ok).toBe(false);
	});

	it('rejects duplicate or invalid persisted entries', () => {
		const target = storage();
		expect(
			saveSavedTunings(
				[
					{ id: 'one', name: 'One', notes },
					{ id: 'one', name: 'Duplicate', notes }
				],
				target
			).ok
		).toBe(false);
	});
});
