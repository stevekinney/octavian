import { expect, test } from '@playwright/test';

const navigation = (page: import('@playwright/test').Page) =>
	page.getByRole('navigation', { name: 'Primary navigation' });

test('opens and closes the mobile navigation with the menu button', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 667 });
	await page.goto('/ear-training');

	const nav = navigation(page);
	const toggle = nav.getByRole('button', { name: 'Navigation menu' });
	const links = page.getByRole('link');

	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(links.first()).toBeHidden();

	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByRole('link', { name: 'Ear training', exact: true })).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(toggle).toBeFocused();
});

test('closes the mobile navigation after client-side navigation', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 667 });
	await page.goto('/ear-training');

	const nav = navigation(page);
	const toggle = nav.getByRole('button', { name: 'Navigation menu' });
	await toggle.click();
	await page.getByRole('link', { name: 'Key signatures', exact: true }).click();

	await expect(page).toHaveURL(/\/key-signatures$/);
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(page.locator('body')).toBeFocused();
});

test('keeps navigation links visible without a brand on desktop', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/ear-training');

	const nav = navigation(page);
	await expect(nav.getByRole('button', { name: 'Navigation menu' })).toBeHidden();
	await expect(page.getByRole('link', { name: 'Ear training', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Key signatures', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Fretboard', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Chords', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Chord training', exact: true })).toBeVisible();
	await expect(nav.getByRole('link')).toHaveCount(5);
	await expect(nav).not.toContainText('Vibratone');
});
