import { expect, test } from '@playwright/test';

for (const width of [320, 768, 1280]) {
	for (const colorScheme of ['light', 'dark'] as const) {
		test(`key signatures work at ${width}px in ${colorScheme} mode`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ colorScheme });
			await page.addInitScript(() => {
				Math.random = () => 0;
			});
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await page.goto('/key-signatures');
			const menuToggle = page.getByRole('button', { name: 'Navigation menu' });
			const mobileMenu = await menuToggle.isVisible();
			if (mobileMenu) await page.getByRole('button', { name: 'Navigation menu' }).click();
			await expect(page.getByRole('link', { name: 'Key signatures', exact: true })).toHaveAttribute(
				'aria-current',
				'page'
			);
			if (mobileMenu) await page.getByRole('button', { name: 'Navigation menu' }).click();
			await expect(page.getByRole('img')).toHaveAccessibleName(/treble.*7 flats/i);
			await expect(page.locator('.stimulus svg')).toBeVisible();
			await expect(page.getByRole('heading', { name: 'Major key signatures' })).toHaveCount(0);
			expect((await page.locator('.feedback').boundingBox())?.height).toBe(0);
			for (const clef of ['Bass', 'Alto', 'Tenor', 'Treble']) {
				await page
					.getByRole('radiogroup', { name: 'Clef' })
					.getByRole('radio', { name: clef, exact: true })
					.click();
				await expect(page.getByRole('img')).toHaveAccessibleName(
					new RegExp(`${clef}.*7 flats`, 'i')
				);
			}

			await expect(page.getByRole('button', { name: 'Next signature' })).toBeDisabled();
			await page.getByRole('button', { name: 'C major', exact: true }).click();
			await expect(page.getByText('Not quite. This is C♭ major.')).toBeVisible();
			await expect(page.getByText('0 of 1 correct', { exact: true })).toBeVisible();
			await page.getByRole('button', { name: 'Next signature' }).click();
			await page.getByRole('button', { name: 'C♭ major', exact: true }).click();
			await expect(page.getByText('Correct! This is C♭ major.')).toBeVisible();
			await expect(page.getByText('1 of 2 correct', { exact: true })).toBeVisible();
			await page
				.getByRole('radiogroup', { name: 'Clef' })
				.getByRole('radio', { name: 'Bass', exact: true })
				.click();
			await expect(page.getByRole('img')).toHaveAccessibleName(/bass.*7 flats/i);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			if (mobileMenu) await page.getByRole('button', { name: 'Navigation menu' }).click();
			await page.getByRole('link', { name: 'Ear training', exact: true }).click();
			await expect(page).toHaveURL(/\/ear-training$/);
			await expect(page.getByRole('button', { name: 'Play the note', exact: true })).toBeVisible();
			expect(errors).toEqual([]);
		});
	}
}

test('home redirects to ear training while preserving the seed', async ({ page }) => {
	await page.goto('/?seed=route-test');
	await expect(page).toHaveURL('/ear-training?seed=route-test');
	await page.getByRole('link', { name: 'Key signatures', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Major key signatures' })).toHaveCount(0);
	await expect(page.getByRole('radiogroup', { name: 'Clef' })).toBeVisible();
});
