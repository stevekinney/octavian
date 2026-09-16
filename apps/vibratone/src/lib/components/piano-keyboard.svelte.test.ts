import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Harness from './piano-keyboard.test-harness.svelte';
import { createPracticeState } from '$lib/state.svelte';
import { keyById, noteLabel } from '$lib/music';

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

describe('piano-keyboard — eligibility', () => {
	it('renders enabled white and black keys while guessing in chromatic', async () => {
		const state = createPracticeState();
		state.play(); // chromatic default → all 12 eligible, phase = guessing
		render(Harness, { state });

		// White keys are labelled by their letter (exact, so "C" ≠ "C♯").
		await expect.element(page.getByRole('button', { name: 'C', exact: true })).toBeEnabled();
		// Chromatic black keys carry both enharmonic spellings in their name.
		await expect.element(page.getByRole('button', { name: 'C♯ or D♭' })).toBeEnabled();
	});

	it('disables keys whose pitch class is not eligible', async () => {
		const state = createPracticeState();
		// Restrict to C and E only.
		for (const pc of [...state.eligibleNotes]) state.toggleNote(pc);
		state.toggleNote(0);
		state.toggleNote(4);
		state.play();
		render(Harness, { state });

		await expect.element(page.getByRole('button', { name: 'C', exact: true })).toBeEnabled();
		await expect.element(page.getByRole('button', { name: 'D', exact: true })).toBeDisabled();
	});
});

describe('piano-keyboard — guessing', () => {
	it('submits the clicked pitch class and reveals a correct answer', async () => {
		const state = createPracticeState();
		// Constrain to white keys only so the answer is always a single-letter key.
		for (const pc of [...state.eligibleNotes]) state.toggleNote(pc);
		for (const pc of [0, 2, 4, 5, 7, 9, 11]) state.toggleNote(pc);
		state.play();
		const answerPc = state.current!.pc;
		render(Harness, { state });

		await page
			.getByRole('button', { name: noteLabel(answerPc, state.spelling), exact: true })
			.click();

		expect(state.phase).toBe('revealed');
		expect(state.guessedPc).toBe(answerPc);
		expect(state.lastCorrect).toBe(true);
		expect(state.session.total).toBe(1);
		expect(state.session.correct).toBe(1);
	});

	it('records a wrong guess and marks it incorrect', async () => {
		const state = createPracticeState();
		for (const pc of [...state.eligibleNotes]) state.toggleNote(pc);
		for (const pc of [0, 2, 4, 5, 7, 9, 11]) state.toggleNote(pc);
		state.play();
		const answerPc = state.current!.pc;
		// Pick a different eligible white-key pitch class.
		const whites = [0, 2, 4, 5, 7, 9, 11];
		const wrongPc = whites.find((pc) => pc !== answerPc)!;
		render(Harness, { state });

		await page
			.getByRole('button', { name: noteLabel(wrongPc, state.spelling), exact: true })
			.click();

		expect(state.phase).toBe('revealed');
		expect(state.guessedPc).toBe(wrongPc);
		expect(state.lastCorrect).toBe(false);
		expect(state.session.correct).toBe(0);
		expect(state.session.total).toBe(1);
	});

	it('ignores clicks on ineligible keys', async () => {
		const state = createPracticeState();
		for (const pc of [...state.eligibleNotes]) state.toggleNote(pc);
		state.toggleNote(0); // only C is eligible
		state.play();
		render(Harness, { state });

		// D is disabled; clicking it must not advance the round.
		await page.getByRole('button', { name: 'D', exact: true }).click({ force: true });
		expect(state.phase).toBe('guessing');
		expect(state.session.total).toBe(0);
	});
});

describe('piano-keyboard — labels follow the key spelling', () => {
	it('labels black keys with flats in a flat key', async () => {
		const state = createPracticeState();
		state.setKey('F'); // flat key → eligible notes become the F-major scale (incl. B♭)
		state.play();
		render(Harness, { state });

		expect(keyById('F').spelling).toBe('flat');
		// B♭ (pc 10) is in F major and should be enabled and labelled as a flat.
		await expect.element(page.getByRole('button', { name: 'B♭', exact: true })).toBeEnabled();
	});
});
