import { expect, test } from '@playwright/test';

test('identifies the default C shape and supports open and muted string editing', async ({
	page
}) => {
	await page.goto('/chords');

	await expect(page.getByRole('heading', { name: 'C' }).first()).toBeVisible();
	await expect(
		page.getByRole('checkbox', { name: 'Allow conventional omissions' })
	).not.toBeChecked();
	await page.getByRole('checkbox', { name: 'Allow conventional omissions' }).check();
	await expect(page.getByRole('checkbox', { name: 'Allow conventional omissions' })).toBeChecked();
	await expect(page.locator('figcaption')).toHaveCount(0);
	await expect(page.getByText('Click notes; drag across strings to barre.')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Add barre', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Mute all strings', exact: true })).toHaveCount(0);

	for (const index of [1, 2, 3, 4, 5])
		await page.getByTestId(`chord-string-toggle-${index}`).click();
	await expect(
		page.getByText('Choose open strings or frets to identify a chord.', { exact: true })
	).toBeVisible();

	await page.getByTestId('chord-string-toggle-5').click();
	await expect(page.getByTestId('chord-string-toggle-5')).toHaveAttribute('aria-pressed', 'true');
	await page.getByTestId('chord-string-toggle-5').click();
	await expect(page.getByTestId('chord-string-toggle-5')).toHaveAttribute('aria-pressed', 'false');
	await page.getByTestId('chord-cell-1-3').click();
	await expect(page.getByTestId('chord-cell-1-3')).toHaveAttribute('aria-pressed', 'true');
	await page.getByTestId('chord-cell-1-3').click();
	await expect(page.getByTestId('chord-cell-1-3')).toHaveAttribute('aria-pressed', 'false');
});

test('edits the starting fret and applies a barre', async ({ page }) => {
	await page.goto('/chords');

	const startingFret = page.getByTestId('chord-chart').getByLabel('Starting fret', { exact: true });
	await startingFret.fill('3');
	await expect(startingFret).toHaveValue('3');
	await expect(
		page.getByTestId('chord-chart').locator('svg text').filter({ hasText: '3' }).first()
	).toBeVisible();

	const first = await page.getByTestId('chord-cell-0-3').boundingBox();
	const last = await page.getByTestId('chord-cell-5-3').boundingBox();
	await page.mouse.move(first!.x + first!.width / 2, first!.y + first!.height / 2);
	await page.mouse.down();
	await page.mouse.move(last!.x + last!.width / 2, last!.y + last!.height / 2, { steps: 6 });
	await page.mouse.up();
	await expect(page.getByTestId('chord-chart').locator('.barre')).toHaveCount(1);
	await page.getByTestId('chord-cell-2-5').click();
	await expect(page.getByTestId('chord-chart').locator('.barre')).toHaveCount(1);
});

test('finds voicings, loads more results, and filters by inversion', async ({ page }) => {
	await page.goto('/chords');
	await page.getByRole('radio', { name: 'Find voicings', exact: true }).click();

	await page.getByRole('button', { name: 'Find voicings', exact: true }).click();
	await expect(page.getByRole('status')).toContainText(/matching|loaded/);
	await expect(page.getByTestId('chord-chart').first()).toBeVisible();

	const loadMore = page.getByRole('button', { name: 'Load more shapes', exact: true });
	if (await loadMore.isVisible()) {
		const before = await page.getByTestId('chord-chart').count();
		await loadMore.click();
		await expect(page.getByTestId('chord-chart')).toHaveCount(before + 12);
	}

	await page.getByLabel('Bass / inversion', { exact: true }).selectOption('0');
	await page.getByRole('button', { name: 'Find voicings', exact: true }).click();
	await expect(page.getByRole('status')).toContainText(/matching|loaded/);
	await expect(page.getByTestId('chord-chart').first()).toBeVisible();
});

for (const width of [320, 849, 1280]) {
	for (const colorScheme of ['light', 'dark'] as const) {
		test(`keeps chord utilities within ${width}px in ${colorScheme} mode`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ colorScheme });
			await page.goto('/chords');
			await expect(page.getByTestId('chord-chart').first()).toBeVisible();
			await expect(page.locator('main.chord-workspace')).toBeVisible();
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
				.toBe(true);

			await page.getByRole('radio', { name: 'Find voicings', exact: true }).click();
			await expect(page.getByRole('button', { name: 'Find voicings', exact: true })).toBeVisible();
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
				.toBe(true);
		});
	}
}
