import { expect, test, type Page } from '@playwright/test';

/** The on-screen piano (scoped so its keys aren't confused with setup chips). */
function keyboard(page: Page) {
	return page.getByRole('group', { name: 'Piano keyboard' });
}

const viewports = [
	{ width: 375, height: 667 },
	{ width: 768, height: 1024 },
	{ width: 849, height: 900 },
	{ width: 1897, height: 1324 },
	{ width: 1280, height: 800 }
];

function useEligibleNotes(page: Page, eligibleNotes = [0, 2]) {
	return page.addInitScript(
		({ eligibleNotes: notes }) => {
			localStorage.setItem(
				'vibratone:settings',
				JSON.stringify({ keyId: 'chromatic', eligibleNotes: notes, octaveLo: 4, octaveHi: 4 })
			);
		},
		{ eligibleNotes }
	);
}

function practiceCard(page: Page) {
	return page.locator('.practice');
}

/**
 * Smoke test of one full guess round: load the app, start a round with Play,
 * guess a note on the keyboard, and confirm the answer is revealed, the score
 * updates, and the round auto-advances.
 */
for (const viewport of viewports) {
	test(`plays a round, reveals the answer, and advances the score at ${viewport.width}x${viewport.height}`, async ({
		page
	}) => {
		await page.clock.install();
		await page.setViewportSize(viewport);
		await page.goto('/ear-training');

		await expect(page.getByText('Press play to hear the first note')).toHaveCount(0);
		await expect(page.getByText('Ready', { exact: true })).toHaveCount(0);
		await expect(page.getByText(/^Round \d+$/, { exact: true })).toHaveCount(0);
		await expect(page.getByText('Octave 4', { exact: true })).toBeVisible();
		await expect(page.getByText('Octaves', { exact: true })).toBeHidden();
		await expect(page.getByText('Identify the note you heard')).toHaveCount(0);

		// Start the first round (also the audio-unlock gesture).
		await page.getByRole('button', { name: 'Play the note' }).click();

		await expect(page.getByText('Round 1')).toBeVisible();
		// Guess by clicking an enabled key. In the chromatic default every key is
		// eligible, so C is always a valid guess.
		await keyboard(page).getByRole('button', { name: 'C', exact: true }).click();

		// The answer is revealed and the session score reflects one completed guess.
		await expect(page.getByText(/^(Correct|Not quite)$/)).toBeVisible();
		await expect(page.locator('.score-bar')).toContainText('of 1 correct');

		await page.clock.fastForward(1600);
		await expect(page.getByText('Round 2')).toBeVisible();
	});
}

test('supports keyboard-only note guessing', async ({ page }) => {
	await page.goto('/ear-training');

	await page.getByRole('button', { name: 'Play the note' }).click();
	const cKey = keyboard(page).getByRole('button', { name: 'C', exact: true });
	for (let index = 0; index < 8; index++) {
		if (await cKey.evaluate((element) => document.activeElement === element)) break;
		await page.keyboard.press('Tab');
	}
	await expect(cKey).toBeFocused();
	await page.keyboard.press('Enter');

	await expect(page.getByText(/^(Correct|Not quite)$/)).toBeVisible();
});

test('the play control keeps its accessible name and replays without advancing', async ({
	page
}) => {
	await page.goto('/ear-training');

	const play = page.getByRole('button', { name: 'Play the note' });
	await expect(play).toBeEnabled();
	await expect(play).toHaveText('');

	await play.click();
	await expect(page.getByText('Round 1')).toBeVisible();
	const replay = page.getByRole('button', { name: 'Replay the note' });
	await expect(replay).toHaveAttribute('aria-label', 'Replay the note');
	await expect(replay).toHaveText('');

	await replay.click();
	await expect(page.getByText('Round 1')).toBeVisible();
	await expect(page.getByText(/^(Correct|Not quite)$/)).toHaveCount(0);
});

for (const viewport of viewports) {
	test(`keeps the practice card height stable through each round state at ${viewport.width}x${viewport.height}`, async ({
		page
	}) => {
		await page.clock.install();
		await page.setViewportSize(viewport);
		await useEligibleNotes(page);
		await page.goto('/ear-training?seed=card-height');

		const card = practiceCard(page);
		const idleHeight = await card.evaluate((element) => element.getBoundingClientRect().height);
		const centers = await card.evaluate((element) => {
			const cardBounds = element.getBoundingClientRect();
			const playBounds = element.querySelector('.play')!.getBoundingClientRect();
			return {
				card: cardBounds.top + cardBounds.height / 2,
				controls: playBounds.top + playBounds.height / 2
			};
		});
		expect(Math.abs(centers.card - centers.controls)).toBeLessThanOrEqual(1);

		await page.getByRole('button', { name: 'Play the note' }).click();
		const guessingHeight = await card.evaluate((element) => element.getBoundingClientRect().height);
		expect(guessingHeight).toBe(idleHeight);

		await keyboard(page).getByRole('button', { name: 'C', exact: true }).click();
		await expect(page.getByText('Correct', { exact: true })).toBeVisible();
		const correctHeight = await card.evaluate((element) => element.getBoundingClientRect().height);
		expect(correctHeight).toBe(idleHeight);

		await page.goto('/ear-training?seed=practice-ui');
		await page.getByRole('button', { name: 'Play the note' }).click();
		await keyboard(page).getByRole('button', { name: 'C', exact: true }).click();
		await expect(page.getByText('Not quite')).toBeVisible();
		const incorrectHeight = await card.evaluate(
			(element) => element.getBoundingClientRect().height
		);
		expect(incorrectHeight).toBe(idleHeight);
	});
}

for (const viewport of viewports) {
	test(`keeps the responsive practice layout within the viewport at ${viewport.width}px`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await page.goto('/ear-training');

		await page.getByLabel('Key', { exact: true }).selectOption('F');
		const reset = page.getByRole('button', { name: 'Reset notes to F Major' });
		await expect(reset).toBeHidden();
		const beforeResetAppears = await page.locator('.octave-field').evaluate((element) => ({
			top: element.getBoundingClientRect().top + window.scrollY,
			height: element.getBoundingClientRect().height
		}));
		const eligible = page.getByRole('group', { name: 'Eligible notes' });
		const cNote = eligible.getByRole('checkbox', { name: 'C', exact: true });
		await expect(eligible.getByRole('checkbox', { checked: true })).toHaveCount(7);
		await cNote.click();
		await expect(cNote).not.toBeChecked();
		await expect(eligible.getByRole('checkbox', { checked: true })).toHaveCount(6);
		await expect(reset).toBeVisible();
		await expect(reset).toHaveAttribute('data-cinder-variant', 'secondary');
		expect(
			await page.locator('.octave-field').evaluate((element) => ({
				top: element.getBoundingClientRect().top + window.scrollY,
				height: element.getBoundingClientRect().height
			}))
		).toEqual(beforeResetAppears);
		await reset.click();
		await expect(reset).toBeHidden();
		expect(
			await page.locator('.octave-field').evaluate((element) => ({
				top: element.getBoundingClientRect().top + window.scrollY,
				height: element.getBoundingClientRect().height
			}))
		).toEqual(beforeResetAppears);
		await expect(cNote).toBeChecked();
		await expect(eligible.getByRole('checkbox', { checked: true })).toHaveCount(7);
		const octaveHeading = await page.locator('.octave-field').evaluate((element) => {
			const label = element.querySelector('label')!.getBoundingClientRect();
			const summary = element
				.querySelector('.cinder-form-field__description')!
				.getBoundingClientRect();
			const slider = element.querySelector('.cinder-slider')!.getBoundingClientRect();
			return {
				labelBottom: label.bottom,
				summaryTop: summary.top,
				summaryBottom: summary.bottom,
				sliderTop: slider.top
			};
		});
		expect(octaveHeading.summaryTop).toBeLessThan(octaveHeading.labelBottom);
		expect(octaveHeading.sliderTop).toBeGreaterThanOrEqual(octaveHeading.summaryBottom);

		const layout = await page.evaluate(() => {
			const bounds = (selector: string) => {
				const element = document.querySelector(selector);
				if (!element) throw new Error(`Missing ${selector}`);
				const box = element.getBoundingClientRect();
				return {
					top: box.top,
					bottom: box.bottom,
					left: box.left,
					right: box.right,
					width: box.width
				};
			};
			const score = document.querySelector('.score-region');
			const stats = score?.querySelector('.stats');
			const statBoxes = [...(score?.querySelectorAll('.stat') ?? [])].map((element) => {
				const box = element.getBoundingClientRect();
				return { top: box.top, bottom: box.bottom, left: box.left };
			});
			const fields = document.querySelector('.fields');
			const fieldBoxes = [...(fields?.querySelectorAll(':scope > .field') ?? [])].map((element) => {
				const box = element.getBoundingClientRect();
				return { top: box.top, bottom: box.bottom, left: box.left };
			});
			return {
				practice: bounds('.practice-column'),
				practiceCard: bounds('.practice-column > .cinder-card:first-child'),
				keyboardCard: bounds('.practice-column > .keyboard-wrapper'),
				setup: bounds('.setup-rail'),
				setupCard: bounds('.setup-rail > .cinder-card'),
				octaves: bounds('.octave-field'),
				score: bounds('.score-region'),
				scoreCard: bounds('.score-region > .score-bar'),
				scoreWidth: score?.getBoundingClientRect().width ?? 0,
				statsColumns: stats ? getComputedStyle(stats).gridTemplateColumns.split(' ').length : 0,
				statBoxes,
				fieldBoxes,
				documentWidth: document.documentElement.scrollWidth,
				viewportWidth: document.documentElement.clientWidth
			};
		});

		expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
		expect(layout.practice.width).toBeGreaterThan(0);
		const keyboardWidth = await keyboard(page).evaluate(
			(element) => element.getBoundingClientRect().width
		);
		expect(keyboardWidth).toBeGreaterThanOrEqual(Math.min(560, layout.practice.width - 42) - 1);
		expect(layout.setup.width).toBeGreaterThan(0);
		expect(layout.score.width).toBeGreaterThan(0);

		if (viewport.width < 960) {
			expect(layout.practice.top).toBeLessThan(layout.setup.top);
			expect(layout.setup.top).toBeLessThan(layout.score.top);
			expect(layout.practice.left).toBeLessThan(layout.setup.right);
			expect(layout.setup.left).toBeLessThan(layout.score.right);
		} else {
			expect(layout.practice.left).toBeLessThan(layout.setup.left);
			expect(layout.setup.top).toBeLessThan(layout.score.top);
			expect(layout.score.top).toBeGreaterThanOrEqual(layout.setup.bottom);
			expect(Math.abs(layout.setup.left - layout.score.left)).toBeLessThanOrEqual(1);
			expect(layout.practiceCard.top).toBe(layout.setupCard.top);
			expect(layout.practiceCard.bottom).toBe(layout.setupCard.bottom);
			expect(layout.keyboardCard.top).toBe(layout.scoreCard.top);
			expect(layout.keyboardCard.bottom).toBe(layout.scoreCard.bottom);
		}

		const expectedScoreColumns = layout.scoreWidth <= 600 ? 2 : 4;
		expect(layout.statsColumns).toBe(expectedScoreColumns);
		expect(layout.statBoxes[0].top).toBe(layout.statBoxes[1].top);
		if (expectedScoreColumns === 2) {
			expect(layout.statBoxes[0].left).toBe(layout.statBoxes[2].left);
		} else {
			expect(layout.statBoxes[0].left).not.toBe(layout.statBoxes[2].left);
		}

		const setupUsesTwoColumns = layout.setup.width >= 560;
		if (setupUsesTwoColumns) {
			expect(layout.fieldBoxes[0].top).toBe(layout.fieldBoxes[1].top);
			expect(layout.fieldBoxes[0].left).not.toBe(layout.fieldBoxes[1].left);
			expect(layout.octaves.top).toBeGreaterThan(layout.fieldBoxes[0].top);
		} else {
			expect(layout.fieldBoxes[0].left).toBe(layout.fieldBoxes[1].left);
			expect(layout.fieldBoxes[1].top).toBeGreaterThan(layout.fieldBoxes[0].bottom);
		}
	});
}

for (const colorScheme of ['light', 'dark'] as const) {
	test(`keeps keyboard contrast and play surface visible in ${colorScheme} mode`, async ({
		page
	}) => {
		await page.emulateMedia({ colorScheme });
		await useEligibleNotes(page, [2, 4]);
		await page.goto('/ear-training');

		await expect(page.getByRole('button', { name: 'Play the note', exact: true })).toBeEnabled();
		const styles = await page.locator('.practice').evaluate(() => {
			const parseColor = (value: string) => {
				const canvas = document.createElement('canvas');
				canvas.width = 1;
				canvas.height = 1;
				const context = canvas.getContext('2d');
				if (!context) return null;
				context.clearRect(0, 0, 1, 1);
				context.fillStyle = value;
				context.fillRect(0, 0, 1, 1);
				const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
				return { r, g, b, alpha: alpha / 255 };
			};
			const luminance = (value: string) => {
				const rgb = parseColor(value);
				if (!rgb) return null;
				const channel = (component: number) => {
					const normalized = component / 255;
					return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
				};
				return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
			};
			const contrast = (foreground: string, background: string) => {
				const foregroundLuminance = luminance(foreground);
				const backgroundLuminance = luminance(background);
				if (foregroundLuminance === null || backgroundLuminance === null) return null;
				const lighter = Math.max(foregroundLuminance, backgroundLuminance);
				const darker = Math.min(foregroundLuminance, backgroundLuminance);
				return (lighter + 0.05) / (darker + 0.05);
			};
			const white = document.querySelector('.white-key') as HTMLElement;
			const black = document.querySelector('.black-key') as HTMLElement;
			const play = document.querySelector('.play') as HTMLElement;
			const whiteStyle = getComputedStyle(white);
			const blackStyle = getComputedStyle(black);
			const playStyle = getComputedStyle(play);
			return {
				keyboardShadow: getComputedStyle(document.querySelector('.keyboard-wrapper')!).boxShadow,
				footerBorder: getComputedStyle(document.querySelector('.score-bar > .cinder-card__footer')!)
					.borderTopWidth,
				lastKeyBorder: getComputedStyle(document.querySelector('.white-key:last-child')!)
					.borderRightWidth,
				whiteLuminance: luminance(whiteStyle.backgroundColor),
				blackLuminance: luminance(blackStyle.backgroundColor),
				blackBorderWidth: blackStyle.borderTopWidth,
				blackBorderColor: blackStyle.borderTopColor,
				playBackground: parseColor(playStyle.backgroundColor),
				playContrast: contrast(playStyle.color, playStyle.backgroundColor)
			};
		});

		expect(styles.keyboardShadow).toBe('none');
		expect(styles.footerBorder).toBe('0px');
		expect(styles.lastKeyBorder).toBe('0px');
		expect(styles.whiteLuminance).toBeGreaterThan(styles.blackLuminance ?? -1);
		expect(styles.blackBorderWidth).not.toBe('0px');
		expect(styles.blackBorderColor).not.toBe('transparent');
		expect(styles.playBackground?.alpha ?? 0).toBeGreaterThan(0);
		expect(styles.playContrast).toBeGreaterThanOrEqual(4.5);
	});
}

test('persists the all-time score across a reload', async ({ page }) => {
	await page.goto('/ear-training');
	await page.getByRole('button', { name: 'Play the note' }).click();
	await keyboard(page).getByRole('button', { name: 'C', exact: true }).click();
	await expect(page.getByText(/^(Correct|Not quite)$/)).toBeVisible();

	await page.reload();

	// The all-time score lives in localStorage and survives the reload; its stat
	// block shows the total number of guesses, confirming the attempt persisted.
	await expect(page.locator('.score-bar')).toContainText('of 1 correct');
});

test('persists a non-default key selection across a reload', async ({ page }) => {
	await page.goto('/ear-training');

	// Switch to F major — a non-default key that changes the hint and the
	// eligible-note set. Reloading into this (not the default) proves settings
	// persistence rather than just defaults.
	await page.getByLabel('Key', { exact: true }).selectOption('F');
	await expect(page.getByText('Notes default to this scale; the tonic is marked.')).toHaveCount(0);

	await page.reload();

	await expect(page.getByLabel('Key', { exact: true })).toHaveValue('F');
	await expect(page.getByText('Notes default to this scale; the tonic is marked.')).toHaveCount(0);
});

test('selects D Dorian and persists its modal scope across a reload', async ({ page }) => {
	await page.goto('/ear-training');

	await page.getByLabel('Key', { exact: true }).selectOption('D');
	await page.getByLabel('Mode', { exact: true }).selectOption('dorian');
	const eligible = page.getByRole('group', { name: 'Eligible notes' });
	for (const note of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
		await expect(eligible.getByRole('checkbox', { name: note, exact: true })).toBeChecked();
	}
	await expect(eligible.getByRole('checkbox', { checked: true })).toHaveCount(7);

	await page.reload();
	await expect(page.getByLabel('Key', { exact: true })).toHaveValue('D');
	await expect(page.getByLabel('Mode', { exact: true })).toHaveValue('dorian');
	await expect(eligible.getByRole('checkbox', { checked: true })).toHaveCount(7);
});

test('records five AttemptEvent objects locally without outbound drill requests', async ({
	page
}) => {
	await page.clock.install();
	const outboundRequests: string[] = [];
	await page.route('**/*', async (route) => {
		const url = new URL(route.request().url());
		if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
			outboundRequests.push(route.request().url());
		}
		await route.continue();
	});
	await page.goto('/ear-training?seed=storage-check');
	await page.getByRole('button', { name: 'Play the note' }).click();

	for (let index = 0; index < 5; index++) {
		await keyboard(page).getByRole('button', { name: 'C', exact: true }).click();
		await expect(page.getByText(/^(Correct|Not quite)$/)).toBeVisible();
		await page.clock.fastForward(1600);
	}

	const attempts = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('vibratone:attempts:v1') ?? '[]')
	);
	expect(attempts).toHaveLength(5);
	expect(attempts[0]).toEqual(
		expect.objectContaining({
			version: 1,
			drillId: 'note-trainer',
			referenceAvailable: true,
			stimulusType: 'synthesized'
		})
	);
	expect(outboundRequests).toEqual([]);
});

test('client-side seed navigation creates a new deterministic practice session', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('/ear-training?seed=first-seed');

	await page.getByRole('button', { name: 'Play the note' }).click();
	await keyboard(page).getByRole('button', { name: 'C', exact: true }).click();

	await page.evaluate(() => {
		const link = document.createElement('a');
		link.href = '/ear-training?seed=second-seed';
		link.textContent = 'Second seed';
		link.id = 'second-seed-link';
		document.body.append(link);
	});
	await page.locator('#second-seed-link').click();
	await expect(page).toHaveURL(/seed=second-seed/);
	await expect(page.getByRole('button', { name: 'Play the note' })).toBeEnabled();
	await expect(page.getByText('Ready', { exact: true })).toHaveCount(0);
	await expect(page.getByText(/^Round \d+$/, { exact: true })).toHaveCount(0);

	await page.getByRole('button', { name: 'Play the note' }).click();
	await keyboard(page).getByRole('button', { name: 'C', exact: true }).click();

	const promptIds = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('vibratone:attempts:v1') ?? '[]').map(
			(event: { promptId: string }) => event.promptId
		)
	);
	expect(promptIds).toEqual([
		expect.stringContaining(':first-seed:'),
		expect.stringContaining(':second-seed:')
	]);
});
