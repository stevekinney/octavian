import { describe, expect, it } from 'vitest';
import { EMPTY_SCORE, isScore } from './scoring.ts';
import {
	isPersistedSettings,
	loadJSON,
	localStorageOrNull,
	removeKey,
	saveJSON,
	sessionStorageOrNull,
	type PersistedSettings
} from './persistence.ts';

/** A minimal in-memory Storage stand-in for unit tests. */
function createMockStorage(initial: Record<string, string> = {}): Storage {
	const map = new Map(Object.entries(initial));
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
		key: (index: number) => [...map.keys()][index] ?? null,
		removeItem: (key: string) => void map.delete(key),
		setItem: (key: string, value: string) => void map.set(key, value)
	} satisfies Storage;
}

/** A Storage whose methods all throw, simulating a locked-down browser. */
function createThrowingStorage(): Storage {
	const fail = () => {
		throw new DOMException('blocked');
	};
	return {
		length: 0,
		clear: fail,
		getItem: fail,
		key: fail,
		removeItem: fail,
		setItem: fail
	} as unknown as Storage;
}

describe('loadJSON', () => {
	it('returns the fallback when storage is null (server)', () => {
		expect(loadJSON(null, 'k', EMPTY_SCORE, isScore)).toEqual(EMPTY_SCORE);
	});

	it('returns the fallback when the key is missing', () => {
		const storage = createMockStorage();
		expect(loadJSON(storage, 'missing', EMPTY_SCORE, isScore)).toEqual(EMPTY_SCORE);
	});

	it('returns a validated stored value', () => {
		const stored = { correct: 3, total: 5, streak: 1, best: 2 };
		const storage = createMockStorage({ score: JSON.stringify(stored) });
		expect(loadJSON(storage, 'score', EMPTY_SCORE, isScore)).toEqual(stored);
	});

	it('falls back on malformed JSON', () => {
		const storage = createMockStorage({ score: '{ not json' });
		expect(loadJSON(storage, 'score', EMPTY_SCORE, isScore)).toEqual(EMPTY_SCORE);
	});

	it('falls back when the parsed value fails validation', () => {
		const storage = createMockStorage({ score: JSON.stringify({ correct: 'no' }) });
		expect(loadJSON(storage, 'score', EMPTY_SCORE, isScore)).toEqual(EMPTY_SCORE);
	});

	it('falls back when getItem throws', () => {
		expect(loadJSON(createThrowingStorage(), 'score', EMPTY_SCORE, isScore)).toEqual(EMPTY_SCORE);
	});
});

describe('saveJSON', () => {
	it('writes a serialized value that round-trips through loadJSON', () => {
		const storage = createMockStorage();
		const score = { correct: 1, total: 1, streak: 1, best: 1 };
		saveJSON(storage, 'score', score);
		expect(loadJSON(storage, 'score', EMPTY_SCORE, isScore)).toEqual(score);
	});

	it('no-ops when storage is null', () => {
		expect(() => saveJSON(null, 'score', EMPTY_SCORE)).not.toThrow();
	});

	it('swallows storage errors', () => {
		expect(() => saveJSON(createThrowingStorage(), 'score', EMPTY_SCORE)).not.toThrow();
	});
});

describe('removeKey', () => {
	it('deletes a stored key', () => {
		const storage = createMockStorage({ score: '{}' });
		removeKey(storage, 'score');
		expect(storage.getItem('score')).toBeNull();
	});

	it('no-ops on null storage and swallows errors', () => {
		expect(() => removeKey(null, 'score')).not.toThrow();
		expect(() => removeKey(createThrowingStorage(), 'score')).not.toThrow();
	});
});

describe('localStorageOrNull / sessionStorageOrNull', () => {
	it('returns null on the server (browser === false under vitest node)', () => {
		expect(localStorageOrNull()).toBeNull();
		expect(sessionStorageOrNull()).toBeNull();
	});
});

describe('isPersistedSettings', () => {
	const valid: PersistedSettings = {
		keyId: 'C',
		eligibleNotes: [0, 2, 4],
		octaveLo: 4,
		octaveHi: 4
	};

	it('accepts a well-formed settings object', () => {
		expect(isPersistedSettings(valid)).toBe(true);
	});

	it('rejects non-objects', () => {
		expect(isPersistedSettings(null)).toBe(false);
		expect(isPersistedSettings('settings')).toBe(false);
	});

	it('rejects a non-string keyId', () => {
		expect(isPersistedSettings({ ...valid, keyId: 7 })).toBe(false);
	});

	it('rejects a non-array or non-numeric eligibleNotes', () => {
		expect(isPersistedSettings({ ...valid, eligibleNotes: 'C' })).toBe(false);
		expect(isPersistedSettings({ ...valid, eligibleNotes: [0, 'x'] })).toBe(false);
	});

	it('rejects non-numeric octave bounds', () => {
		expect(isPersistedSettings({ ...valid, octaveLo: '4' })).toBe(false);
	});
});

describe('re-exported isScore', () => {
	it('is the scoring validator', () => {
		expect(isScore(EMPTY_SCORE)).toBe(true);
	});
});
