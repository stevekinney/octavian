import { expect, test } from '@playwright/test';

test('plays and scores a fixed-root chord exercise', async ({ page }) => {
	await page.goto('/chord-training');
	await expect(page.getByRole('button', { name: 'Play chord', exact: true })).toBeVisible();
	await expect(page.getByRole('group', { name: 'Choose the chord' })).toBeVisible();
	await expect(page.getByRole('checkbox', { name: 'Major', exact: true })).toBeVisible();
	await expect(page.getByRole('checkbox', { name: 'Minor', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Play chord', exact: true }).click();
	const answer = page.getByRole('group', { name: 'Choose the chord' }).getByRole('button').first();
	await expect(answer).toBeEnabled();
	await answer.click();
	await expect(page.getByText(/Correct!|Not quite\./)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Next chord', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Play chord', exact: true }).click();
});

test('switches to diatonic mode and supports seventh chord settings', async ({ page }) => {
	await page.goto('/chord-training');
	await page.getByLabel('Mode', { exact: true }).selectOption('diatonic');
	await expect(page.getByLabel('Key', { exact: true })).toBeVisible();
	await expect(
		page.getByRole('group', { name: 'Choose the chord' }).getByRole('button')
	).toHaveCount(7);
	await page.getByRole('checkbox', { name: 'Include seventh chords' }).check();
	await expect(page.getByRole('button', { name: 'Play chord', exact: true })).toBeVisible();
});

for (const width of [320, 849, 1280]) {
	for (const colorScheme of ['light', 'dark'] as const) {
		test(`keeps chord training within ${width}px in ${colorScheme} mode`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ colorScheme });
			await page.goto('/chord-training');
			await expect(page.getByRole('button', { name: 'Play chord', exact: true })).toBeVisible();
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
				.toBe(true);
		});
	}
}

test('puts practice first and aligns settings in one desktop row', async ({ page }) => {
	await page.setViewportSize({ width: 1487, height: 1000 });
	await page.goto('/chord-training');
	const play = await page.getByRole('button', { name: 'Play chord', exact: true }).boundingBox();
	const answers = await page.getByRole('group', { name: 'Choose the chord' }).boundingBox();
	const mode = await page.getByLabel('Mode', { exact: true }).boundingBox();
	const inversion = await page.getByLabel('Inversion', { exact: true }).boundingBox();
	expect(play).not.toBeNull();
	expect(answers).not.toBeNull();
	expect(mode).not.toBeNull();
	expect(inversion).not.toBeNull();
	expect(answers!.y).toBeGreaterThan(play!.y + play!.height + 16);
	expect(mode!.y).toBeGreaterThan(answers!.y + answers!.height);
	expect(Math.abs(mode!.y - inversion!.y)).toBeLessThan(1);
	expect(Math.abs(mode!.width - inversion!.width)).toBeLessThan(1);
});

test('starts with two triads and scopes the questions and answers by chord type', async ({
	page
}) => {
	await page.goto('/chord-training');
	const answers = page.getByRole('group', { name: 'Choose the chord' }).getByRole('button');
	await expect(answers).toHaveCount(2);
	await page.getByRole('checkbox', { name: 'Sevenths', exact: true }).check();
	await expect(answers).toHaveCount(5);
	await page.getByRole('checkbox', { name: 'Triads, suspended & power', exact: true }).uncheck();
	await expect(answers).toHaveCount(3);
	await page.getByRole('button', { name: 'Play chord', exact: true }).click();
	await expect(answers.first()).toBeEnabled();
	await answers.first().click();
	await expect(page.getByText(/Correct!|Not quite\./)).toBeVisible();
	await page.getByRole('checkbox', { name: 'Sevenths', exact: true }).uncheck();
	await expect(answers).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Play chord', exact: true })).toHaveCount(0);
});
