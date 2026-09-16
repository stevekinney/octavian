import { browser } from '$app/environment';
import { localStorageOrNull } from './persistence';

export const TUNING_STORAGE_KEY = 'vibratone:saved-tunings';

export type SavedTuning = {
	readonly id: string;
	readonly name: string;
	readonly notes: readonly number[];
};

export type TuningStorageResult<T> =
	{ readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

const MIN_NOTES = 2;
const MAX_NOTES = 8;

export function isValidTuningNotes(value: unknown): value is readonly number[] {
	return (
		Array.isArray(value) &&
		value.length >= MIN_NOTES &&
		value.length <= MAX_NOTES &&
		value.every((note) => Number.isInteger(note) && note >= 0 && note <= 103)
	);
}

export function isSavedTuning(value: unknown): value is SavedTuning {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.id === 'string' &&
		candidate.id.length > 0 &&
		typeof candidate.name === 'string' &&
		candidate.name.trim().length > 0 &&
		isValidTuningNotes(candidate.notes)
	);
}

export function isSavedTunings(value: unknown): value is readonly SavedTuning[] {
	return (
		Array.isArray(value) &&
		value.every(isSavedTuning) &&
		new Set(value.map((tuning) => tuning.id)).size === value.length
	);
}

function storageOrNull(storage?: Storage | null): Storage | null {
	if (storage !== undefined) return storage;
	return browser ? localStorageOrNull() : null;
}

function readStoredTunings(storage?: Storage | null): TuningStorageResult<readonly SavedTuning[]> {
	const target = storageOrNull(storage);
	if (!target) return { ok: false, error: 'Saved tunings are unavailable in this browser.' };
	try {
		const raw = target.getItem(TUNING_STORAGE_KEY);
		if (!raw) return { ok: true, value: [] };
		const parsed: unknown = JSON.parse(raw);
		return isSavedTunings(parsed)
			? { ok: true, value: parsed }
			: { ok: false, error: 'Saved tuning data is malformed and was left unchanged.' };
	} catch {
		return { ok: false, error: 'Saved tuning data is malformed and was left unchanged.' };
	}
}

export function readSavedTunings(
	storage?: Storage | null
): TuningStorageResult<readonly SavedTuning[]> {
	return readStoredTunings(storage);
}

export function loadSavedTunings(storage?: Storage | null): readonly SavedTuning[] {
	const result = readStoredTunings(storage);
	return result.ok ? result.value : [];
}

export function saveSavedTunings(
	tunings: readonly SavedTuning[],
	storage?: Storage | null
): TuningStorageResult<readonly SavedTuning[]> {
	if (!isSavedTunings(tunings)) return { ok: false, error: 'Saved tuning data is invalid.' };
	const target = storageOrNull(storage);
	if (!target) return { ok: false, error: 'Saved tunings are unavailable in this browser.' };
	try {
		target.setItem(TUNING_STORAGE_KEY, JSON.stringify(tunings));
		return { ok: true, value: tunings };
	} catch {
		return { ok: false, error: 'Saved tunings could not be written to this browser.' };
	}
}

export function createSavedTuning(
	name: string,
	notes: readonly number[],
	storage?: Storage | null
): TuningStorageResult<SavedTuning> {
	const trimmedName = name.trim();
	if (!trimmedName) return { ok: false, error: 'Enter a name for this tuning.' };
	if (!isValidTuningNotes(notes)) return { ok: false, error: 'Use 2–8 valid MIDI notes.' };
	let id: string;
	try {
		id = `saved-${crypto.randomUUID()}`;
	} catch {
		return { ok: false, error: 'Saved tunings are unavailable in this browser.' };
	}
	const tuning = { id, name: trimmedName, notes: [...notes] };
	const current = readStoredTunings(storage);
	if (!current.ok) return current;
	const result = saveSavedTunings([...current.value, tuning], storage);
	return result.ok ? { ok: true, value: tuning } : result;
}

export function updateSavedTuning(
	id: string,
	name: string,
	notes: readonly number[],
	storage?: Storage | null
): TuningStorageResult<SavedTuning> {
	const trimmedName = name.trim();
	if (!trimmedName) return { ok: false, error: 'Enter a name for this tuning.' };
	if (!isValidTuningNotes(notes)) return { ok: false, error: 'Use 2–8 valid MIDI notes.' };
	const stored = readStoredTunings(storage);
	if (!stored.ok) return stored;
	if (!stored.value.some((tuning) => tuning.id === id))
		return { ok: false, error: 'Select a saved tuning to update.' };
	const tuning = { id, name: trimmedName, notes: [...notes] };
	const result = saveSavedTunings(
		stored.value.map((item) => (item.id === id ? tuning : item)),
		storage
	);
	return result.ok ? { ok: true, value: tuning } : result;
}

export function removeSavedTuning(
	id: string,
	storage?: Storage | null
): TuningStorageResult<readonly SavedTuning[]> {
	const stored = readStoredTunings(storage);
	if (!stored.ok) return stored;
	const tunings = stored.value;
	if (!tunings.some((tuning) => tuning.id === id))
		return { ok: false, error: 'Select a saved tuning to remove.' };
	return saveSavedTunings(
		tunings.filter((tuning) => tuning.id !== id),
		storage
	);
}
