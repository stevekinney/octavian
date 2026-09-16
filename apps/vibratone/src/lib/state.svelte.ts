/**
 * The Vibratone practice-session state, as a *factory* rather than module-level
 * runes. Module-scoped `$state` would be a single instance shared across every
 * SvelteKit SSR request; a factory keeps each session's state, timer, and audio
 * scoped to the component subtree that creates it. Instantiate once in
 * `+page.svelte` and distribute via Svelte context.
 *
 * Persistence is written from the action functions directly (not an ambient
 * `$effect`) so a save is always a deliberate, traceable consequence of a
 * mutation — never an accidental overwrite during hydration.
 */

import { createContext } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import { getSynth, DEFAULT_NOTE_LENGTH, DEFAULT_TONE, type Tone } from './audio.ts';
import {
	keyById,
	scalePitchClassSet,
	type KeyDefinition,
	type Pitch,
	type PitchClass,
	type Spelling
} from './music.ts';
import {
	ALL_TIME_SCORE_KEY,
	SESSION_SCORE_KEY,
	SETTINGS_KEY,
	isPersistedSettings,
	isScore,
	loadJSON,
	localStorageOrNull,
	removeKey,
	saveJSON,
	sessionStorageOrNull,
	type PersistedSettings
} from './persistence.ts';
import { normalizeOctaveRange, poolSize } from './round.ts';
import { EMPTY_SCORE, applyGuess, percent, type Score } from './scoring.ts';
import {
	SESSION_ID,
	appendAttemptEvent,
	createSeededSession,
	pitchClassEquals,
	type DrillConfig,
	type DrillPrompt
} from './learning/drills';

/** Where the app is in the round lifecycle. */
export type Phase = 'idle' | 'guessing' | 'revealed';

/** How long to linger on a revealed answer before the next round, in ms. */
const AUTO_ADVANCE_MS = 1600;

const DEFAULT_SETTINGS: PersistedSettings = {
	keyId: 'chromatic',
	eligibleNotes: Array.from({ length: 12 }, (_, pc) => pc),
	octaveLo: 4,
	octaveHi: 4
};

const DRILL_ID = 'note-trainer';

export type PracticeState = ReturnType<typeof createPracticeState>;

/**
 * Type-safe context for the practice state. `setPracticeState` provides the
 * instance to a component subtree; `getPracticeState` reads it and throws if no
 * provider is present.
 */
const [getPracticeState, setPracticeState] = createContext<PracticeState>();
export { getPracticeState, setPracticeState };

/** Construct a practice-session state instance. Call once per session. */
export function createPracticeState(seed: string | null = null) {
	const sessionStore = sessionStorageOrNull();
	const localStore = localStorageOrNull();
	const sessionSeed = seed && seed.length > 0 ? seed : null;

	const loadedSettings = loadJSON(localStore, SETTINGS_KEY, DEFAULT_SETTINGS, isPersistedSettings);
	const [initialLo, initialHi] = normalizeOctaveRange(
		loadedSettings.octaveLo,
		loadedSettings.octaveHi
	);

	// --- Settings ---
	let keyId = $state(loadedSettings.keyId);
	const eligibleNotes = new SvelteSet<PitchClass>(loadedSettings.eligibleNotes);
	let octaveLo = $state(initialLo);
	let octaveHi = $state(initialHi);

	// --- Scores ---
	let session = $state<Score>(loadJSON(sessionStore, SESSION_SCORE_KEY, EMPTY_SCORE, isScore));
	let allTime = $state<Score>(loadJSON(localStore, ALL_TIME_SCORE_KEY, EMPTY_SCORE, isScore));

	// --- Round ---
	let round = $state(0);
	let currentPrompt = $state<DrillPrompt | null>(null);
	let phase = $state<Phase>('idle');
	let guessedPc = $state<PitchClass | null>(null);
	let lastCorrect = $state(false);
	let started = $state(false);
	let audioError = $state<string | null>(null);
	let autoAdvanceTimer: ReturnType<typeof setTimeout> | undefined;
	let promptStartedAt = 0;
	let promptSequence: DrillPrompt[] = [];
	let promptSequenceIndex = 0;
	let promptSequenceKey = '';
	let promptOrdinal = 0;
	let currentReferenceAvailable = false;

	// Audio is hard-coded (no Tweaks panel) but the synth supports all tones.
	const tone: Tone = DEFAULT_TONE;
	const noteLength = DEFAULT_NOTE_LENGTH;

	// --- Derived ---
	const key = $derived<KeyDefinition>(keyById(keyId));
	const spelling = $derived<Spelling>(key.spelling);
	const eligibleCount = $derived(eligibleNotes.size);
	const available = $derived(poolSize(eligibleNotes, octaveLo, octaveHi));
	const canPlay = $derived(available > 0);
	const current = $derived<Pitch | null>(
		currentPrompt ? { pc: currentPrompt.pitchClass, octave: currentPrompt.octave } : null
	);

	function persistSettings(): void {
		const payload: PersistedSettings = {
			keyId,
			eligibleNotes: [...eligibleNotes].sort((a, b) => a - b),
			octaveLo,
			octaveHi
		};
		saveJSON(localStore, SETTINGS_KEY, payload);
	}

	function clearTimer(): void {
		if (autoAdvanceTimer !== undefined) {
			clearTimeout(autoAdvanceTimer);
			autoAdvanceTimer = undefined;
		}
	}

	function drillConfig(): DrillConfig {
		return {
			drillId: DRILL_ID,
			seed: sessionSeed ?? undefined,
			eligiblePitchClasses: [...eligibleNotes].sort((a, b) => a - b),
			octaveLo,
			octaveHi,
			timbre: tone
		};
	}

	function sequenceKey(config: DrillConfig): string {
		return JSON.stringify(config);
	}

	function nextPrompt(): DrillPrompt | null {
		const config = drillConfig();
		const key = sequenceKey(config);
		if (key !== promptSequenceKey) {
			promptSequence = createSeededSession(config, undefined, promptOrdinal);
			promptSequenceIndex = 0;
			promptSequenceKey = key;
		} else if (promptSequenceIndex >= promptSequence.length) {
			promptSequence = createSeededSession(config, undefined, promptOrdinal);
			promptSequenceIndex = 0;
		}
		const prompt = promptSequence[promptSequenceIndex++] ?? null;
		if (prompt) promptOrdinal += 1;
		return prompt;
	}

	/** Pick and play a fresh prompt, advancing the round counter. */
	function nextRound(): void {
		clearTimer();
		const prompt = nextPrompt();
		if (!prompt) {
			currentPrompt = null;
			phase = 'idle';
			return;
		}
		currentPrompt = prompt;
		guessedPc = null;
		phase = 'guessing';
		promptStartedAt = Date.now();
		round += 1;
		currentReferenceAvailable = false;
		sound(prompt);
	}

	/** Synthesize the given prompt. Best-effort; visible error when audio is unavailable. */
	function sound(prompt: DrillPrompt): void {
		const synth = getSynth();
		if (!synth) {
			currentReferenceAvailable = false;
			audioError = 'Audio is unavailable in this browser. You can still answer the drill.';
			return;
		}
		audioError = null;
		try {
			const wasRunning = synth.state === 'running';
			const resumed = synth.resume();
			synth.play(prompt.frequencyHz, { tone, length: noteLength });
			if (wasRunning) currentReferenceAvailable = true;
			void resumed
				.then(() => {
					if (currentPrompt?.promptId === prompt.promptId) {
						currentReferenceAvailable = true;
						audioError = null;
					}
				})
				.catch(() => {
					if (currentPrompt?.promptId === prompt.promptId) {
						currentReferenceAvailable = false;
						audioError = 'Audio could not start. You can still answer the drill or try replay.';
					}
				});
		} catch {
			currentReferenceAvailable = false;
			audioError = 'Audio could not start. You can still answer the drill or try replay.';
		}
	}

	/**
	 * The Play action. The first invocation must run synchronously inside the
	 * click handler: it constructs and resumes the `AudioContext` and starts the
	 * note in the same call stack so the browser keeps the gesture association.
	 */
	function play(): void {
		if (!canPlay) return;
		started = true;
		nextRound();
	}

	/** Replay the current note without changing any state. */
	function replay(): void {
		if (currentPrompt) sound(currentPrompt);
	}

	/** Submit a pitch-class guess. Octave is ignored — only pitch class matters. */
	function guess(pc: PitchClass): void {
		if (phase !== 'guessing' || !currentPrompt) return;
		const wasCorrect = pitchClassEquals(pc, currentPrompt.pitchClass);
		guessedPc = pc;
		lastCorrect = wasCorrect;
		phase = 'revealed';

		session = applyGuess(session, wasCorrect);
		allTime = applyGuess(allTime, wasCorrect);
		saveJSON(sessionStore, SESSION_SCORE_KEY, session);
		saveJSON(localStore, ALL_TIME_SCORE_KEY, allTime);
		appendAttemptEvent({
			version: 1,
			drillId: DRILL_ID,
			promptId: currentPrompt.promptId,
			sessionId: SESSION_ID,
			timestamp: Date.now(),
			responseTimeMs: Math.max(0, Date.now() - promptStartedAt),
			answer: pc,
			correctAnswer: currentPrompt.pitchClass,
			correct: wasCorrect,
			pitchClass: currentPrompt.pitchClass,
			octave: currentPrompt.octave,
			timbre: currentPrompt.timbre,
			frequencyHz: currentPrompt.frequencyHz,
			referenceAvailable: currentReferenceAvailable,
			stimulusType: currentPrompt.stimulusType
		});

		clearTimer();
		autoAdvanceTimer = setTimeout(() => {
			autoAdvanceTimer = undefined;
			if (canPlay) nextRound();
			else {
				phase = 'idle';
				currentPrompt = null;
			}
		}, AUTO_ADVANCE_MS);
	}

	function resetSession(): void {
		session = EMPTY_SCORE;
		removeKey(sessionStore, SESSION_SCORE_KEY);
	}

	/**
	 * Reset the all-time score. Since the session is a subset of all time,
	 * clearing all time necessarily clears the session too.
	 */
	function resetAllTime(): void {
		allTime = EMPTY_SCORE;
		removeKey(localStore, ALL_TIME_SCORE_KEY);
		resetSession();
	}

	/**
	 * Choose a key: sets the accidental spelling, marks the tonic, and resets the
	 * eligible-note set to that key's diatonic major scale (Chromatic → all 12).
	 */
	function setKey(id: string): void {
		keyId = id;
		matchKey();
	}

	/** Reset the eligible-note set to the current key's scale. */
	function matchKey(): void {
		const scale = scalePitchClassSet(key);
		eligibleNotes.clear();
		for (const pc of scale) eligibleNotes.add(pc);
		persistSettings();
	}

	/** Toggle a single pitch class in or out of the eligible set. */
	function toggleNote(pc: PitchClass): void {
		if (eligibleNotes.has(pc)) eligibleNotes.delete(pc);
		else eligibleNotes.add(pc);
		persistSettings();
	}

	/** Commit a new octave range from the slider (already normalized lo ≤ hi). */
	function setOctaves(lo: number, hi: number): void {
		const [low, high] = normalizeOctaveRange(lo, hi);
		octaveLo = low;
		octaveHi = high;
		persistSettings();
	}

	/** Tear down the auto-advance timer. Call from component cleanup. */
	function destroy(): void {
		clearTimer();
	}

	return {
		// settings
		get keyId() {
			return keyId;
		},
		get key() {
			return key;
		},
		get spelling() {
			return spelling;
		},
		eligibleNotes,
		get octaveLo() {
			return octaveLo;
		},
		get octaveHi() {
			return octaveHi;
		},
		get eligibleCount() {
			return eligibleCount;
		},
		get available() {
			return available;
		},
		get canPlay() {
			return canPlay;
		},
		// scores
		get session() {
			return session;
		},
		get allTime() {
			return allTime;
		},
		get sessionPercent() {
			return percent(session);
		},
		get allTimePercent() {
			return percent(allTime);
		},
		// round
		get round() {
			return round;
		},
		get current() {
			return current;
		},
		get currentPrompt() {
			return currentPrompt;
		},
		get phase() {
			return phase;
		},
		get guessedPc() {
			return guessedPc;
		},
		get lastCorrect() {
			return lastCorrect;
		},
		get started() {
			return started;
		},
		get audioError() {
			return audioError;
		},
		get tone() {
			return tone;
		},
		// actions
		play,
		replay,
		guess,
		resetSession,
		resetAllTime,
		setKey,
		matchKey,
		toggleNote,
		setOctaves,
		destroy
	};
}
