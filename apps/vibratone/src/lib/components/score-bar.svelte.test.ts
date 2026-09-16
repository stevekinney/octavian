import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Harness from './score-bar.test-harness.svelte';
import { createPracticeState } from '$lib/state.svelte';

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

/** Play one round and guess `correct`ly or not, building up a non-zero score. */
function scoreOne(state: ReturnType<typeof createPracticeState>, correct: boolean) {
	state.play();
	const pc = state.current!.pc;
	state.guess(correct ? pc : (pc + 1) % 12);
}

function scoreBarText(): string {
	return (
		page.getByText('This session', { exact: true }).element().closest('.score-bar')!.textContent ??
		''
	);
}

function statValues(label: string): string[] {
	const term = [...document.querySelectorAll('dt')].find(
		(candidate) => candidate.textContent?.trim() === label
	);
	if (!term) throw new Error(`Missing stat label: ${label}`);
	return [...term.parentElement!.querySelectorAll('dd')].map(
		(definition) => definition.textContent?.trim() ?? ''
	);
}

describe('score-bar — display', () => {
	it('shows a dash for both scores before any attempts', async () => {
		const state = createPracticeState();
		render(Harness, { state });

		// An untouched score reads "—", not "0%", which would look like failure.
		expect(scoreBarText()).toContain('—');
		expect(scoreBarText()).toContain('0 of 0 correct');
	});

	it('reflects a recorded guess in both stat blocks', async () => {
		const state = createPracticeState();
		scoreOne(state, true);
		render(Harness, { state });

		const text = scoreBarText();
		expect(text).toContain('100%');
		expect(text).toContain('1 of 1 correct');
	});

	it('associates each stat label with its definitions', async () => {
		const state = createPracticeState();
		scoreOne(state, true);
		render(Harness, { state });

		expect(statValues('This session')).toEqual(['100%', '1 of 1 correct']);
		expect(statValues('Current streak')).toEqual(['1', 'correct in a row']);
		expect(statValues('Best streak')).toEqual(['1', 'this session']);
		expect(statValues('All time')).toEqual(['100%', '1 of 1 correct']);
	});

	it('resets the current streak while keeping the best streak', async () => {
		const state = createPracticeState();
		scoreOne(state, true);
		scoreOne(state, false);
		render(Harness, { state });

		expect(statValues('Current streak')).toEqual(['0', 'correct in a row']);
		expect(statValues('Best streak')).toEqual(['1', 'this session']);
	});
});

describe('score-bar — reset', () => {
	it('keeps reset actions hidden until the menu is opened', async () => {
		const state = createPracticeState();
		render(Harness, { state });

		await expect.element(page.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
		await expect.element(page.getByRole('menuitem', { name: 'Session' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('menuitem', { name: 'All time' })).not.toBeInTheDocument();
	});

	it('reveals reset actions when the menu is opened', async () => {
		const state = createPracticeState();
		render(Harness, { state });

		await page.getByRole('button', { name: 'Reset' }).click();

		await expect.element(page.getByRole('menuitem', { name: 'Session' })).toBeInTheDocument();
		await expect.element(page.getByRole('menuitem', { name: 'All time' })).toBeInTheDocument();
	});

	it('clears only the session score with "Session"', async () => {
		const state = createPracticeState();
		scoreOne(state, true);
		render(Harness, { state });

		await page.getByRole('button', { name: 'Reset' }).click();
		await page.getByRole('menuitem', { name: 'Session' }).click();

		expect(state.session.total).toBe(0);
		expect(state.allTime.total).toBe(1); // all-time untouched
	});

	it('clears both scores with "All time" (session is a subset of all time)', async () => {
		const state = createPracticeState();
		scoreOne(state, true);
		scoreOne(state, false);
		render(Harness, { state });

		await page.getByRole('button', { name: 'Reset' }).click();
		await page.getByRole('menuitem', { name: 'All time' }).click();

		expect(state.allTime.total).toBe(0);
		expect(state.session.total).toBe(0);
		// The display zeroes out, confirming reactivity flows through the button.
		expect(scoreBarText()).toContain('0 of 0 correct');
	});

	it('persists an all-time reset to storage', async () => {
		const state = createPracticeState();
		scoreOne(state, true);
		render(Harness, { state });

		await page.getByRole('button', { name: 'Reset' }).click();
		await page.getByRole('menuitem', { name: 'All time' }).click();

		// A fresh state instance loads the cleared scores from storage.
		const reloaded = createPracticeState();
		expect(reloaded.session.total).toBe(0);
		expect(reloaded.allTime.total).toBe(0);
	});
});
