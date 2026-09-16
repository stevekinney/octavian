import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { ATTEMPT_LOG_KEY } from '$lib/learning/drills';
import { resetSynth } from '$lib/audio';
import { createFakeAudioContext } from '$lib/audio/__mocks__/fake-audio-context';
import { createPracticeState } from '$lib/state.svelte';
import Harness from './practice-card.test-harness.svelte';

const originalAudioContext = window.AudioContext;
const originalWebkitAudioContext = (
	window as typeof window & { webkitAudioContext?: typeof AudioContext }
).webkitAudioContext;

function installRunningAudioContext(): void {
	const RunningAudioContext = function () {
		return createFakeAudioContext();
	} as unknown as typeof AudioContext;
	Object.defineProperty(window, 'AudioContext', {
		configurable: true,
		value: RunningAudioContext
	});
	Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
}

function restoreAudioContext(): void {
	Object.defineProperty(window, 'AudioContext', {
		configurable: true,
		value: originalAudioContext
	});
	Object.defineProperty(window, 'webkitAudioContext', {
		configurable: true,
		value: originalWebkitAudioContext
	});
}

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	resetSynth();
	installRunningAudioContext();
});

afterEach(() => {
	resetSynth();
	restoreAudioContext();
});

function attemptLog(): unknown[] {
	return JSON.parse(localStorage.getItem(ATTEMPT_LOG_KEY) ?? '[]') as unknown[];
}

describe('practice-card — drill events', () => {
	it('emits AttemptEvent to localStorage after a correct guess', () => {
		const state = createPracticeState('component-correct');
		state.play();
		render(Harness, { state });

		state.guess(state.current!.pc);

		expect(attemptLog()).toHaveLength(1);
		expect(attemptLog()[0]).toMatchObject({
			version: 1,
			drillId: 'note-trainer',
			answer: state.current!.pc,
			correctAnswer: state.current!.pc,
			correct: true,
			referenceAvailable: true,
			stimulusType: 'synthesized'
		});
	});

	it('emits AttemptEvent to localStorage after an incorrect guess', () => {
		const state = createPracticeState('component-incorrect');
		state.play();
		render(Harness, { state });
		const answer = state.current!.pc;
		const wrong = (answer + 1) % 12;

		state.guess(wrong);

		expect(attemptLog()).toHaveLength(1);
		expect(attemptLog()[0]).toMatchObject({
			answer: wrong,
			correctAnswer: answer,
			correct: false
		});
	});

	it('replay does not append an AttemptEvent', () => {
		const state = createPracticeState('component-replay');
		state.play();
		render(Harness, { state });

		state.replay();

		expect(attemptLog()).toEqual([]);
	});
});

describe('practice-card — audio errors', () => {
	it('audio error region is non-empty when audioError is set', async () => {
		const originalAudioContext = window.AudioContext;
		const originalWebkitAudioContext = (
			window as typeof window & { webkitAudioContext?: typeof AudioContext }
		).webkitAudioContext;
		try {
			Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
			Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });

			const state = createPracticeState('audio-error');
			state.play();
			render(Harness, { state });

			await expect.element(page.getByRole('alert')).toMatchTextContent(/Audio is unavailable/);
			expect(state.phase).toBe('guessing');
		} finally {
			Object.defineProperty(window, 'AudioContext', {
				configurable: true,
				value: originalAudioContext
			});
			Object.defineProperty(window, 'webkitAudioContext', {
				configurable: true,
				value: originalWebkitAudioContext
			});
		}
	});
});
