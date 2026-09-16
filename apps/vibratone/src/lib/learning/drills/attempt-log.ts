import { localStorageOrNull } from '../../persistence.ts';
import { isAttemptEvent, type AttemptEvent } from './schema.ts';

export const ATTEMPT_LOG_KEY = 'vibratone:attempts:v1';
export const MAX_ATTEMPT_LOG_EVENTS = 500;

function createSessionId(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	const bytes = new Uint8Array(16);
	let entropy = Date.now() ^ Math.floor(Math.random() * 0xffffffff);
	for (let index = 0; index < bytes.length; index++) {
		entropy = (entropy * 1664525 + 1013904223) >>> 0;
		bytes[index] = entropy & 0xff;
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
		16,
		20
	)}-${hex.slice(20)}`;
}

export const SESSION_ID = createSessionId();

export function loadAttemptLog(): AttemptEvent[] {
	const storage = localStorageOrNull();
	if (!storage) return [];

	let raw: string | null;
	try {
		raw = storage.getItem(ATTEMPT_LOG_KEY);
	} catch {
		return [];
	}
	if (raw === null) return [];

	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter(isAttemptEvent) : [];
	} catch {
		return [];
	}
}

export function appendAttemptEvent(event: AttemptEvent): void {
	const storage = localStorageOrNull();
	if (!storage) return;

	try {
		const boundedLog = [...loadAttemptLog(), event].slice(-MAX_ATTEMPT_LOG_EVENTS);
		storage.setItem(ATTEMPT_LOG_KEY, JSON.stringify(boundedLog));
	} catch {
		// Disabled or full storage must not break a local drill session.
	}
}
