import { expect, test } from '@playwright/test';

const viewports = [320, 768, 1280];
const colorSchemes = ['light', 'dark'] as const;

function fretboard(page: import('@playwright/test').Page) {
	return page.getByRole('grid', { name: 'Guitar fretboard' });
}

function eligibleNotes(page: import('@playwright/test').Page) {
	return page.getByRole('group', { name: 'Eligible notes' });
}

async function useDeterministicPosition(page: import('@playwright/test').Page) {
	await page.addInitScript(() => {
		Math.random = () => 0;
	});
}

test('supports all three exercises and scores equivalent notes in any octave', async ({ page }) => {
	await useDeterministicPosition(page);
	await page.goto('/fretboard');

	await expect(page.getByRole('heading', { name: 'Fretboard practice' })).toHaveCount(0);
	await expect(page.getByRole('group', { name: 'Fret range' })).toHaveCount(0);
	await expect(page.locator('.prompt')).toHaveCount(0);
	expect((await page.locator('.feedback').boundingBox())?.height).toBe(0);
	await expect(fretboard(page).getByRole('gridcell', { name: 'String 6 fret 0' })).toHaveAttribute(
		'data-highlighted',
		'true'
	);

	const exercise = page.getByLabel('Exercise', { exact: true });
	await exercise.selectOption('text');
	await expect(page.locator('.target-note')).toHaveText('E');
	await expect(page.getByText('Any octave')).toBeVisible();

	// The deterministic target is open low E. E3 at string 5, fret 7 is an
	// equivalent pitch class and proves that octave is intentionally ignored.
	const equivalentE = fretboard(page).getByRole('gridcell', { name: 'String 5 fret 7' });
	await equivalentE.click();
	await expect(page.getByText('Correct!')).toBeVisible();
	await expect(page.getByText('1 of 1 correct', { exact: true })).toBeVisible();
	await expect(equivalentE).toHaveClass(/selected/);
	await expect(equivalentE).toHaveAttribute('data-highlighted', 'true');
	await expect(fretboard(page).locator('[data-highlighted="true"]')).toHaveCount(1);
	await expect(equivalentE).toHaveAttribute('aria-label', 'String 5 fret 7');
	await expect(page.getByRole('button', { name: 'Next note', exact: true })).toBeEnabled();

	await page.getByRole('button', { name: 'Next note', exact: true }).click();
	await expect(page.getByText('1 of 1 correct', { exact: true })).toBeVisible();

	await exercise.selectOption('notation');

	await expect(page.getByText('Any octave')).toBeVisible();
	await expect(page.getByRole('img', { name: /Music notation in treble clef/ })).toBeVisible();
	await expect(page.locator('.notation svg')).toBeVisible();
	const notationBounds = await page.locator('.prompt > .notation').boundingBox();
	const instrumentBounds = await page.getByTestId('fretboard').boundingBox();
	expect(notationBounds!.y).toBeGreaterThanOrEqual(instrumentBounds!.y + instrumentBounds!.height);

	await fretboard(page).getByRole('gridcell', { name: 'String 6 fret 12', exact: true }).click();
	await expect(page.getByText('2 of 2 correct', { exact: true })).toBeVisible();
	await expect(fretboard(page).locator('[aria-selected="true"]')).toHaveAttribute(
		'data-highlighted',
		'true'
	);
	await expect(fretboard(page).locator('[data-highlighted="true"]')).toHaveCount(1);

	await exercise.selectOption('name');
	await expect(page.locator('.prompt')).toHaveCount(0);
	await page
		.getByRole('group', { name: 'Name the highlighted note' })
		.getByRole('button', { name: 'E', exact: true })
		.click();
	await expect(page.getByText('3 of 3 correct', { exact: true })).toBeVisible();

	await exercise.selectOption('text');
	const wrongNote = fretboard(page).getByRole('gridcell', { name: 'String 6 fret 1', exact: true });
	await wrongNote.click();
	await expect(page.getByText('Not quite.', { exact: false })).toBeVisible();
	await expect(wrongNote).toHaveAttribute('aria-selected', 'true');
	await expect(wrongNote).toHaveAttribute('data-highlighted', 'false');
	await expect(
		fretboard(page).getByRole('gridcell', { name: 'String 6 fret 0', exact: true })
	).toHaveAttribute('data-highlighted', 'true');
});

test('limits targets to the selected key and handles an empty eligible-note selection', async ({
	page
}) => {
	await useDeterministicPosition(page);
	await page.goto('/fretboard');

	await page.getByLabel('Key', { exact: true }).selectOption('G');
	await expect(page.getByRole('button', { name: 'Reset notes to G Major' })).toBeHidden();
	await expect(eligibleNotes(page).getByRole('checkbox', { checked: true })).toHaveCount(7);
	await expect(eligibleNotes(page).getByRole('checkbox', { checked: false })).toHaveCount(5);

	// Remove every eligible pitch class. The exercise must become explicitly
	// empty instead of presenting a stale question from the previous scope.
	const pressedNotes = eligibleNotes(page).getByRole('checkbox', { checked: true });
	for (let index = (await pressedNotes.count()) - 1; index >= 0; index--) {
		await pressedNotes.nth(index).click();
	}
	await expect(page.getByText('Select at least one eligible note to begin.')).toBeVisible();
	await expect(page.locator('.prompt')).toHaveCount(0);
	await expect(page.getByRole('group', { name: 'Name the highlighted note' })).toHaveCount(0);
	const boardBounds = await page.getByTestId('fretboard').boundingBox();
	const messageBounds = await page.getByRole('status').boundingBox();
	expect(messageBounds!.y).toBeGreaterThanOrEqual(boardBounds!.y + boardBounds!.height);
	expect(messageBounds!.height).toBeLessThan(48);

	await expect(fretboard(page).getByRole('gridcell')).toHaveCount(6 * 23);
	await expect(fretboard(page).getByRole('gridcell').first()).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Next note', exact: true })).toBeDisabled();
});

test('supports preset and custom tunings, including invalid custom input', async ({ page }) => {
	await useDeterministicPosition(page);
	await page.goto('/fretboard');

	for (const [fretCount, expectedCells] of [
		['21', 6 * 22],
		['22', 6 * 23],
		['24', 6 * 25]
	] as const) {
		await page
			.getByRole('radiogroup', { name: 'Fret count' })
			.getByRole('radio', { name: fretCount, exact: true })
			.click();
		await expect(fretboard(page).getByRole('gridcell')).toHaveCount(expectedCells);
	}

	await page.getByLabel('Tuning', { exact: true }).selectOption('dropD');
	await expect(page.getByText('D2', { exact: true })).toBeVisible();
	await page.getByLabel('Tuning', { exact: true }).selectOption('custom');
	const tuningInput = page.getByLabel('Open strings, low to high', { exact: true });
	await tuningInput.fill('not notes');
	await page.getByRole('button', { name: 'Apply tuning', exact: true }).click();
	await expect(page.getByText(/Enter 2–8 notes with octaves/)).toBeVisible();

	await tuningInput.fill('D2 A2 D3 G3 B3 E4');
	await page.getByRole('button', { name: 'Apply tuning', exact: true }).click();
	await expect(page.getByText(/Enter 2–8 notes with octaves/)).toHaveCount(0);
	await expect(page.getByText('D2', { exact: true })).toBeVisible();
});

for (const width of viewports) {
	for (const colorScheme of colorSchemes) {
		test(`keeps the fretboard accessible and within ${width}px in ${colorScheme} mode`, async ({
			page
		}) => {
			await useDeterministicPosition(page);
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ colorScheme });
			await page.goto('/fretboard');

			await expect(fretboard(page)).toBeVisible();
			await expect(fretboard(page).getByRole('gridcell').first()).toHaveAttribute(
				'aria-label',
				/^String \d+ fret \d+$/
			);
			await expect(page.getByRole('group', { name: 'Eligible notes' })).toBeVisible();
			const stringChoice = page
				.getByRole('group', { name: 'Strings', exact: true })
				.getByRole('checkbox', { name: 'String 1 · E4', exact: true });
			const noteChoice = eligibleNotes(page).getByRole('checkbox', { name: 'C', exact: true });
			await expect(stringChoice).toBeChecked();
			await expect(noteChoice).toBeChecked();
			await stringChoice.click();
			await expect(stringChoice).not.toBeChecked();
			await expect(stringChoice).toBeEnabled();
			await stringChoice.press('Space');
			await expect(stringChoice).toBeChecked();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);

			await page.getByLabel('Exercise', { exact: true }).selectOption('text');
			const target = fretboard(page).getByRole('gridcell', {
				name: 'String 5 fret 7'
			});
			await target.click();
			await expect(target).toHaveClass(/selected/);
			await expect(target).toHaveAttribute('data-highlighted', 'true');
			await expect(fretboard(page).locator('[data-highlighted="true"]')).toHaveCount(1);
		});
	}
}

test('saves, updates, and removes a tuning across reloads', async ({ page }) => {
	await page.goto('/fretboard');
	const tuningSelect = page.getByLabel('Tuning', { exact: true });
	await tuningSelect.selectOption('custom');
	await page.getByLabel('Open strings, low to high', { exact: true }).fill('D2 A2 D3 G3 B3 E4');
	await page.getByLabel('Save tuning as', { exact: true }).fill('My tuning');
	await page.getByRole('button', { name: 'Save as new', exact: true }).click();
	const savedId = await tuningSelect.inputValue();
	await expect(tuningSelect.locator('option', { hasText: 'Saved: My tuning' })).toHaveCount(1);
	await page.reload();
	await tuningSelect.selectOption(savedId);
	await expect(page.getByText('D2', { exact: true })).toBeVisible();
	await page.getByLabel('Open strings, low to high', { exact: true }).fill('C2 G2 C3 F3 A3 D4');
	await page.getByRole('button', { name: 'Update', exact: true }).click();
	await page.reload();
	await tuningSelect.selectOption(savedId);
	await expect(page.getByText('C2', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Remove', exact: true }).click();
	await page.reload();
	await expect(tuningSelect.locator('option', { hasText: 'Saved: My tuning' })).toHaveCount(0);
});

for (const width of [375, 1280]) {
	test(`edits an open string directly on the fretboard at ${width}px`, async ({ page }) => {
		await useDeterministicPosition(page);
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/fretboard');
		await page.getByRole('button', { name: 'Tune string 6', exact: true }).click();
		await page.getByLabel('Note', { exact: true }).selectOption('0');
		await page.keyboard.press('Escape');
		await expect(page.getByLabel('Tuning', { exact: true })).toHaveValue('custom');
		await expect(page.getByRole('button', { name: 'Tune string 6', exact: true })).toHaveText('C2');
		await page
			.getByRole('group', { name: 'Name the highlighted note' })
			.getByRole('button', { name: 'C', exact: true })
			.click();
		await expect(page.getByText('1 of 1 correct', { exact: true })).toBeVisible();
	});
}

test('scopes targets and answers to strings, octaves, and practice frets', async ({ page }) => {
	await useDeterministicPosition(page);
	await page.goto('/fretboard');
	await page.getByLabel('Exercise', { exact: true }).selectOption('text');
	for (const number of [1, 2, 3, 4, 5]) {
		await page
			.getByRole('group', { name: 'Strings', exact: true })
			.getByRole('checkbox', { name: new RegExp(`^String ${number} ·`) })
			.click();
	}
	await fretboard(page).getByRole('gridcell', { name: 'String 1 fret 0', exact: true }).click();
	await expect(page.getByText('Choose a position within the selected range.')).toBeVisible();
	await expect(page.getByText('0 of 0 correct', { exact: true })).toBeVisible();
	await page
		.getByRole('slider', { name: 'Octave range minimum value', exact: true })
		.press('ArrowRight');
	await expect(page.locator('.target-note')).toHaveText('C');
	await fretboard(page).getByRole('gridcell', { name: 'String 6 fret 8', exact: true }).click();
	await expect(page.getByText('1 of 1 correct', { exact: true })).toBeVisible();
	await page
		.getByRole('slider', { name: 'Practice frets maximum value', exact: true })
		.press('Home');
	await expect(page.getByText('No notes match these settings.')).toBeVisible();
	await page.getByRole('slider', { name: 'Octave range minimum value', exact: true }).press('Home');
	await expect(page.locator('.target-note')).toHaveText('E');
	await fretboard(page).getByRole('gridcell', { name: 'String 6 fret 12', exact: true }).click();
	await expect(page.getByText('Choose a position within the selected range.')).toBeVisible();
	await fretboard(page).getByRole('gridcell', { name: 'String 6 fret 0', exact: true }).click();
	await expect(page.getByText('2 of 2 correct', { exact: true })).toBeVisible();
	await expect(fretboard(page).locator('[aria-selected="true"]')).toHaveAttribute(
		'data-highlighted',
		'true'
	);
	await expect(fretboard(page).locator('[data-highlighted="true"]')).toHaveCount(1);
});

test('selects multiple strings and handles an empty string selection', async ({ page }) => {
	await useDeterministicPosition(page);
	await page.goto('/fretboard');
	await page.getByLabel('Exercise', { exact: true }).selectOption('text');
	const strings = page.getByRole('group', { name: 'Strings', exact: true });
	await expect(strings.getByRole('checkbox', { checked: true })).toHaveCount(6);
	for (const number of [2, 3, 4, 5]) {
		await strings.getByRole('checkbox', { name: new RegExp(`^String ${number} ·`) }).click();
	}
	await expect(strings.getByRole('checkbox', { checked: true })).toHaveCount(2);
	await fretboard(page).getByRole('gridcell', { name: 'String 1 fret 0', exact: true }).click();
	await expect(page.getByText('1 of 1 correct', { exact: true })).toBeVisible();
	await strings.getByRole('checkbox', { name: /^String 1 ·/ }).click();
	await fretboard(page).getByRole('gridcell', { name: 'String 6 fret 0', exact: true }).click();
	await expect(page.getByText('2 of 2 correct', { exact: true })).toBeVisible();
	await expect(fretboard(page).locator('[aria-selected="true"]')).toHaveAttribute(
		'data-highlighted',
		'true'
	);
	await expect(fretboard(page).locator('[data-highlighted="true"]')).toHaveCount(1);
	await strings.getByRole('checkbox', { name: /^String 6 ·/ }).click();
	await expect(page.getByText('Select at least one string to begin.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Next note', exact: true })).toBeDisabled();
	await strings.getByRole('checkbox', { name: /^String 1 ·/ }).click();
	await expect(page.locator('.target-note')).toHaveText('E');
});
