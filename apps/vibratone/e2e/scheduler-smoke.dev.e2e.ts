import { expect, test } from '@playwright/test';

const viewports = [
	{ width: 375, height: 667 },
	{ width: 768, height: 1024 },
	{ width: 1280, height: 800 }
];

for (const viewport of viewports) {
	test(`scheduler-smoke controls are visible at ${viewport.width}x${viewport.height}`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await page.goto('/scheduler-smoke');

		const play = page.getByRole('button', { name: 'Play 16-note diatonic sequence' });
		const stop = page.getByRole('button', { name: 'Stop sequence' });

		await expect(play).toBeVisible();
		await expect(stop).toBeVisible();
		const playBox = await play.boundingBox();
		const stopBox = await stop.boundingBox();
		expect(playBox?.height).toBeGreaterThanOrEqual(44);
		expect(stopBox?.height).toBeGreaterThanOrEqual(44);
	});
}

test('scheduler-smoke play and stop buttons toggle disabled state correctly', async ({ page }) => {
	await page.goto('/scheduler-smoke');

	const play = page.getByRole('button', { name: 'Play 16-note diatonic sequence' });
	const stop = page.getByRole('button', { name: 'Stop sequence' });

	await expect(play).toBeEnabled();
	await expect(stop).toBeDisabled();
	await play.click();
	await expect(play).toBeDisabled();
	await expect(stop).toBeEnabled();
	await stop.click();
	await expect(play).toBeEnabled();
	await expect(stop).toBeDisabled();
});

test('scheduler-smoke supports keyboard play and stop', async ({ page }) => {
	await page.goto('/scheduler-smoke');

	const play = page.getByRole('button', { name: 'Play 16-note diatonic sequence' });
	const stop = page.getByRole('button', { name: 'Stop sequence' });

	await expect(play).toBeEnabled();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Ear training', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Key signatures', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Fretboard', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Chords', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Chord training', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(play).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(stop).toBeEnabled();
	await page.keyboard.press('Tab');
	await expect(stop).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(play).toBeEnabled();
});

test('scheduler-smoke shows an alert when AudioContext is unavailable', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
		Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
	});
	await page.goto('/scheduler-smoke');

	await expect(page.getByRole('alert')).toHaveText(/Audio is unavailable/);
	await expect(page.getByRole('button', { name: 'Play 16-note diatonic sequence' })).toBeDisabled();
});

test('scheduler-smoke cleans up when navigating away', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	await page.goto('/scheduler-smoke');

	await page.getByRole('button', { name: 'Play 16-note diatonic sequence' }).click();
	await page.goto('/ear-training');

	expect(errors).toEqual([]);
});
