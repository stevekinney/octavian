/**
 * Typed, defensive wrappers over Web Storage. Loads validate the parsed shape
 * and fall back to a default on anything unexpected (missing key, malformed
 * JSON, wrong shape, or no storage at all on the server). There is intentionally
 * no schema migration: this is a new app with no prior data in the wild.
 */

import { browser } from '$app/environment';
import { isScore, type Score } from './scoring.ts';

/** Storage keys, namespaced so they don't collide with other apps on the origin. */
export const SESSION_SCORE_KEY = 'vibratone:session-score';
export const ALL_TIME_SCORE_KEY = 'vibratone:all-time-score';
export const SETTINGS_KEY = 'vibratone:settings';

/** The persisted settings shape. `eligibleNotes` is stored as a plain array. */
export type PersistedSettings = {
	keyId: string;
	eligibleNotes: number[];
	octaveLo: number;
	octaveHi: number;
};

/**
 * Read and validate a JSON value from storage. Returns `fallback` when the
 * storage is absent, the key is missing, the JSON is malformed, or the parsed
 * value fails `validate`.
 */
export function loadJSON<T>(
	storage: Storage | null,
	key: string,
	fallback: T,
	validate: (value: unknown) => value is T
): T {
	if (!storage) return fallback;
	let raw: string | null;
	try {
		raw = storage.getItem(key);
	} catch {
		return fallback;
	}
	if (raw === null) return fallback;
	try {
		const parsed: unknown = JSON.parse(raw);
		return validate(parsed) ? parsed : fallback;
	} catch {
		return fallback;
	}
}

/** Serialize and write a value to storage. Silently no-ops when storage is absent. */
export function saveJSON<T>(storage: Storage | null, key: string, value: T): void {
	if (!storage) return;
	try {
		storage.setItem(key, JSON.stringify(value));
	} catch {
		// Quota errors or disabled storage are non-fatal for an ear-training app.
	}
}

/** Remove a key from storage. Silently no-ops when storage is absent. */
export function removeKey(storage: Storage | null, key: string): void {
	if (!storage) return;
	try {
		storage.removeItem(key);
	} catch {
		// Ignore — see saveJSON.
	}
}

/** The browser `localStorage`, or `null` on the server / when unavailable. */
export function localStorageOrNull(): Storage | null {
	if (!browser) return null;
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

/** The browser `sessionStorage`, or `null` on the server / when unavailable. */
export function sessionStorageOrNull(): Storage | null {
	if (!browser) return null;
	try {
		return window.sessionStorage;
	} catch {
		return null;
	}
}

/** Validate a parsed value as {@link PersistedSettings}. */
export function isPersistedSettings(value: unknown): value is PersistedSettings {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.keyId === 'string' &&
		Array.isArray(candidate.eligibleNotes) &&
		candidate.eligibleNotes.every((note) => typeof note === 'number') &&
		typeof candidate.octaveLo === 'number' &&
		typeof candidate.octaveHi === 'number'
	);
}

/** Re-export so callers can validate a {@link Score} without a second import. */
export { isScore };
export type { Score };
