# 19. Unified Today Surface and Launch Documentation

## Outcome

A returning learner lands on a Today surface that recommends one due AP item, one supporting item from any enrolled non-AP track, and one free-play item—all without requiring an account, a database, or manual navigation across four separate track entry points. A new visitor can read launch documentation that explains the AP program, track options, browser support, privacy posture, and honest AP caveats before starting practice.

This milestone does not build the Producer track, step sequencer, or chord progression lab. Those are delivered by M15 and M16 respectively. M19 integrates their outputs into a unified learner-facing surface and adds launch documentation that covers all tracks.

## Product Requirements

- **Today surface**: A route at `src/routes/today/+page.svelte` that recommends exactly three items: one AP item, one optional supporting item from a non-AP enrolled track (nullable when none is enrolled), and one free-play item (always present).
- **Recommendation algorithm**: The algorithm is deterministic and local-first—no network call, no server. See the specification in Module and Architecture Targets.
- **Zero-state handling**: When a learner has completed no placement and enrolled in no tracks, the Today surface shows onboarding cards (AP placement CTA as primary, "Explore tracks" as supporting, step sequencer link as free-play). No empty dashboard.
- **Enrolled-but-nothing-due handling**: When a learner has at least one lifetime attempt on a non-AP track but no cards are currently due, the supporting slot falls back to the highest-confusion weak-concept item from that track (lowest accuracy) rather than showing the null placeholder. The null placeholder only appears when no non-AP track has `isEnrolled()` returning `true`.
- **Stale recommendation refresh**: A recommendation set is stale 30 minutes after `composedAt`. When the Today surface detects staleness on any render cycle, it displays a "Refresh recommendations" button. Clicking the button calls `composeToday(buildReadersFromLocalStorage())` and updates the displayed recommendation without a full navigation. The staleness threshold is exported as `TODAY_STALE_AFTER_MS` from `today.ts` so tests and component code reference the same value.
- **Launch documentation**: Eight static pages under `src/routes/docs/` covering the AP program, privacy posture, browser support, teacher workflow, accessibility, microphone, MIDI, and relative pitch. Every page must be reachable from the app's main navigation and pass `bun run check`.
- **No new tracks**: M19 owns no Producer drill logic, no step-sequencer keyboard controls, no chord-lab playback. Those capabilities are integration points delivered by M15 and M16.
- **No auth, database, or billing**: Every feature in this milestone operates entirely on localStorage and static content.

## User Experience Requirements

- AP remains the primary landing-page story. The existing `src/routes/+page.svelte` (AP trainer) stays at the root. Today is reachable from the app header navigation but is not the index.
- The app header (`src/lib/components/app-header.svelte`) gains two new nav links: `/today` labeled "Today" (placed before track-specific links) and `/docs` labeled "Guide" (placed last). Both are native `<a>` elements for correct keyboard semantics, right-click behavior, and SvelteKit preload support.
- The Today surface must display a visible reason string for each recommendation so the learner understands why that item was chosen.
- The supporting slot renders an accessible placeholder ("Nothing due right now—explore tracks") when `supportingItem` is `null` (no non-AP track enrolled), rather than collapsing layout unexpectedly. When the learner is enrolled in a non-AP track but has nothing due, the supporting slot shows a weak-concept fallback drill instead of the placeholder.
- The free-play item is framed as exploration, not review. It never displays due-card language.
- Documentation must make browser support and privacy boundaries immediately visible—no buried footnotes.
- The Today surface must work at phone (375 px), tablet (768 px), and desktop (1280 px) without horizontal scroll or hidden interactive targets.
- All documentation pages render meaningfully without JavaScript (progressive enhancement).

## Data and Analytics Requirements

- The Today surface emits a `TodayImpressionEvent` on mount (once per render) and a `TodaySelectionEvent` when the learner activates any slot.
- Both events are appended to localStorage-backed logs (keys: `vibratone:today-impressions`, `vibratone:today-selections`), capped at 90 entries each to prevent localStorage exhaustion before the database milestone.
- `TodaySelectionEvent` must include `sourceTrack: TodayTrack` and `recommendationSlot: TodaySlot` (camelCase, matching codebase convention). `TodayImpressionEvent` is a surface-level event and is exempt from per-slot attribution fields.
- Per-track analytics (AP, Relative Pitch, Theory, Production) remain separable: events from M19 must not merge track attribution into a single untyped field.
- Free-play slot activation must not emit an `AttemptEvent` (which increments session scoring). It emits a `TodaySelectionEvent` with `recommendationSlot: 'free-play'` only.

## Accessibility Requirements

- The Today surface renders three landmark sections, each with a distinct accessible name visible to assistive technology (e.g., `role="region"` with an `aria-labelledby` pointing to a visible heading).
- Each recommendation card includes a visible reason string referenced by `aria-describedby` on the card element so screen-reader users hear the reason alongside the drill title.
- Tab traversal visits the AP slot, the supporting slot (when present), and the free-play slot in document order. Focus is not trapped; Tab exits to the page header after the last slot.
- Activating any slot with Enter or Space produces the same outcome as a mouse click.
- The AP section is first in document order (screen-reader traversal matches visual priority).
- All launch documentation pages pass an axe-core accessibility scan (zero violations in landmark, heading, and interactive-element categories) in CI. Scanning is implemented with `@axe-core/playwright` (added as a dev dependency before M19 e2e work begins: `bun add -d @axe-core/playwright`).
- Every documentation page has a valid heading hierarchy (no skipped levels) and all images include alt text.
- All documentation links are keyboard-reachable with Tab alone.

## Module and Architecture Targets

### `src/routes/today/+page.ts` (new)

SvelteKit reads page options from `+page.ts`, not from the instance `<script>` inside `+page.svelte`. Add this file to disable SSR for the Today route.

```ts
// Today is fully personalized from localStorage; SSR has no access to
// per-user data and must not attempt a render.
export const ssr = false;
```

### `src/routes/docs/+layout.ts` (new)

A single layout-level export that all eight documentation pages inherit; no need to repeat the option in each `+page.svelte`.

```ts
// All eight documentation pages are static prose — prerender at build time.
export const prerender = true;
```

### `src/lib/learning/scheduling/today.ts` (new)

Core recommendation composition. A pure function—no localStorage reads inside; all storage access is injected via `TrackAnalyticsReader` instances so the function is unit-testable without a DOM.

```typescript
// Canonical types for the Today surface
export type TodaySlot = 'primary' | 'supporting' | 'free-play';

export type TodayTrack = 'ap' | 'relative-pitch' | 'theory' | 'production';

export type TodayRecommendationSource = 'fsrs-due' | 'weak-concept' | 'free-play' | 'fallback';

export interface DrillRef {
	type: 'drill'; // discriminant tag for union narrowing in Svelte markup
	drillId: string;
	drillConfig: Record<string, unknown>;
	reason: string; // human-readable; also used as accessible description
	source: TodayRecommendationSource;
	track: TodayTrack;
}

export interface TodayRecommendation {
	apItem: DrillRef | { type: 'placement-cta' } | null;
	supportingItem: DrillRef | null;
	freePlayItem: { type: 'sequencer' | 'chord-lab'; reason: string };
	composedAt: number; // Date.now() — used to detect stale recommendations
}

/**
 * Injectable analytics reader for one track.
 * Returns empty arrays / false when the track has no data — never throws.
 */
export interface TrackAnalyticsReader {
	track: TodayTrack;
	/** True when the learner has at least one lifetime attempt recorded for this track. */
	isEnrolled: () => boolean;
	/**
	 * Returns due items sorted by retrievability ascending (most overdue first).
	 * retrievability is in [0, 1]; lower = more overdue (FSRS convention).
	 */
	getDueItems: () => {
		drillId: string;
		drillConfig: Record<string, unknown>;
		retrievability: number;
	}[];
	getWeakConcepts: () => {
		drillId: string;
		drillConfig: Record<string, unknown>;
		accuracy: number;
	}[];
	getWeeklyAttemptCount: () => number;
}

/** Stale after 30 minutes. */
export const TODAY_STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * Returns true when the recommendation is older than TODAY_STALE_AFTER_MS.
 * Accepts an explicit `now` so unit tests can pass a fixed timestamp;
 * the component's `$derived` reads a reactive `nowMs` signal to trigger
 * re-evaluation as wall-clock time advances.
 */
export function isStale(recommendation: TodayRecommendation, now: number = Date.now()): boolean {
	return now - recommendation.composedAt > TODAY_STALE_AFTER_MS;
}

export function composeToday(readers: TrackAnalyticsReader[]): TodayRecommendation;
```

**Slot-filling rules (deterministic)**:

- **`apItem`**: The FSRS card with the lowest `retrievability` (most overdue) from the AP reader's `getDueItems()`. If no AP due items exist, falls back to the pitch class with lowest `accuracy` from `getWeakConcepts()`. If both are empty (cold start), returns `{ type: 'placement-cta' }`.
- **`supportingItem`**: Uses this exact priority order:
  1. Collect all non-AP readers where `isEnrolled()` is `true` and `getDueItems().length > 0`.
  2. Among those, pick the item with the lowest `retrievability` value (most overdue) across all qualifying readers.
  3. Tie-break on equal `retrievability`: pick the reader with the lowest `getWeeklyAttemptCount()` (least-practiced track wins).
  4. Final tie-break: alphabetical order by `track` value.
  5. If no non-AP reader has `isEnrolled()` returning `true`, return `null`.
  6. If `isEnrolled()` is `true` for a non-AP reader but `getDueItems()` returns `[]`, fall back to the highest-confusion item from `getWeakConcepts()` (lowest accuracy). Only return `null` when no non-AP reader has `isEnrolled()` returning `true`.
- **`freePlayItem`**: Defaults to `{ type: 'sequencer' }`. Switches to `{ type: 'chord-lab' }` when the chord-lab reader's `getWeeklyAttemptCount()` is lower than the sequencer reader's count. The free-play item is never an FSRS-due card and never sets `source: 'fsrs-due'` or `source: 'weak-concept'`.

### `src/lib/learning/analytics/today-events.ts` (new)

```typescript
export type TodayImpressionEvent = {
	eventType: 'today-impression';
	timestamp: number;
	composedAt: number;
	apSlotType: 'drill' | 'placement-cta' | 'null';
	supportingSlotPresent: boolean;
	freePlayType: 'sequencer' | 'chord-lab';
};

export type TodaySelectionEvent = {
	eventType: 'today-selection';
	timestamp: number;
	sourceTrack: TodayTrack; // camelCase throughout
	recommendationSlot: TodaySlot; // camelCase throughout
	drillId: string | null; // null for placement-cta and free-play items
	source: TodayRecommendationSource;
};

export const TODAY_IMPRESSIONS_KEY = 'vibratone:today-impressions';
export const TODAY_SELECTIONS_KEY = 'vibratone:today-selections';

/**
 * Append a Today impression; cap at 90 entries.
 * Accepts an optional storage parameter for test injection
 * (defaults to localStorageOrNull()).
 */
export function logTodayImpression(event: TodayImpressionEvent, storage?: Storage | null): void;

/**
 * Append a Today selection; cap at 90 entries.
 * Accepts an optional storage parameter for test injection
 * (defaults to localStorageOrNull()).
 */
export function logTodaySelection(event: TodaySelectionEvent, storage?: Storage | null): void;

export function isTodayImpressionEvent(value: unknown): value is TodayImpressionEvent;
export function isTodaySelectionEvent(value: unknown): value is TodaySelectionEvent;
```

Both functions use the existing `saveJSON` / `loadJSON` pattern from `src/lib/persistence.ts`. No server call. The injectable `storage` parameter mirrors `persistence.ts`'s pattern and enables node-environment unit tests via `createMockStorage()`.

### `src/routes/today/+page.svelte` (new)

The Today surface page. The `ssr = false` page option is in `+page.ts`, not here. All composition happens in `onMount`.

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { composeToday, TODAY_STALE_AFTER_MS, isStale } from '$lib/learning/scheduling/today';
	import { buildReadersFromLocalStorage } from '$lib/learning/scheduling/today-readers';
	import TodaySurface from '$lib/components/today-surface.svelte';
	import type { TodayRecommendation } from '$lib/learning/scheduling/today';

	// $state.raw: TodayRecommendation is reassigned wholesale, never mutated in place.
	let recommendation = $state.raw<TodayRecommendation | null>(null);

	// nowMs is a reactive clock: updated by the interval and visibilitychange.
	// isStale reads nowMs as an explicit argument, making it a reactive dependency
	// of the $derived — so the button appears automatically when 30 minutes elapse.
	let nowMs = $state(Date.now());
	let stale = $derived(recommendation !== null && isStale(recommendation, nowMs));

	$effect(() => {
		// Tick every 5 minutes so isStale re-evaluates without aggressive polling.
		const id = setInterval(
			() => {
				nowMs = Date.now();
			},
			5 * 60 * 1000
		);
		return () => clearInterval(id);
	});

	onMount(() => {
		recommendation = composeToday(buildReadersFromLocalStorage());
	});

	function refresh() {
		recommendation = composeToday(buildReadersFromLocalStorage());
		nowMs = Date.now();
	}
</script>

<svelte:document
	onvisibilitychange={() => {
		if (document.visibilityState === 'visible') nowMs = Date.now();
	}}
/>

{#if recommendation}
	{#if stale}
		<button onclick={refresh}>Refresh recommendations</button>
	{/if}
	<TodaySurface {recommendation} onrefresh={refresh} />
{:else}
	<p aria-live="polite">Loading your recommendations…</p>
{/if}
```

> [!NOTE] `isStale` accepts an explicit `now: number` argument. The component passes the reactive `nowMs` signal as that argument inside `$derived`, so Svelte tracks `nowMs` as a dependency and recomputes `stale` whenever the interval or `visibilitychange` updates it. The interval is cleaned up via the `$effect` teardown return.

### `src/lib/learning/scheduling/today-readers.ts` (new)

```typescript
/**
 * Construct TrackAnalyticsReader instances from localStorage.
 * Returns an array of zero to four readers; missing tracks return empty-array
 * readers with isEnrolled() === false.
 *
 * Must only be called inside onMount or an event handler—never at module
 * initialization time—because it reads localStorage.
 */
export function buildReadersFromLocalStorage(): TrackAnalyticsReader[];

/**
 * Maps a DrillRef to the SvelteKit route URL the learner navigates to.
 * Returns the track root route when drillId is not recognized.
 */
export function resolveDrillRoute(ref: DrillRef): string;

/**
 * Route mapping (canonical):
 *   track: 'ap'             → '/'             (existing AP trainer; resumes from localStorage settings)
 *   track: 'relative-pitch' → '/relative-pitch'
 *   track: 'theory'         → '/theory'
 *   track: 'production'     → '/production'
 *   type: 'sequencer'       → '/sequencer'    (M16 route)
 *   type: 'chord-lab'       → '/progression'  (M16 route)
 */

/**
 * localStorage key written by recommendation-card.svelte before navigating,
 * consumed and immediately cleared by each track's +page.svelte in onMount.
 * Expires after 10 minutes to avoid stale config bleeding across sessions.
 */
export const PENDING_DRILL_KEY = 'vibratone:pending-drill';

export type PendingDrill = {
	drillId: string;
	drillConfig: Record<string, unknown>;
	track: TodayTrack;
	expiresAt: number; // Date.now() + 10 * 60 * 1000
};
```

**localStorage key contracts** (per-track FSRS data read by `buildReadersFromLocalStorage()`):

| Track          | Key                                | Value shape                |
| -------------- | ---------------------------------- | -------------------------- |
| AP             | `vibratone:fsrs:ap:v1`             | `Record<string, FsrsCard>` |
| Relative Pitch | `vibratone:fsrs:relative-pitch:v1` | `Record<string, FsrsCard>` |
| Theory         | `vibratone:fsrs:theory:v1`         | `Record<string, FsrsCard>` |
| Production     | `vibratone:fsrs:production:v1`     | `Record<string, FsrsCard>` |

Where `FsrsCard` (local to `today-readers.ts`, not exported) is:

```typescript
type FsrsCard = {
	due: number; // Unix ms timestamp
	stability: number;
	difficulty: number;
	lapses: number;
	correct: number;
	total: number;
	state: 'new' | 'learning' | 'review' | 'relearning';
};
```

`retrievability` for a card is computed from the FSRS formula using `stability` and `due`. When a track's localStorage key is absent, `buildReadersFromLocalStorage()` returns an empty-array reader with `isEnrolled(): () => false` for that track. `composeToday` falls back gracefully to placement CTAs and sequencer free-play.

### `src/lib/components/today-surface.svelte` (new)

- Props: `{ recommendation: TodayRecommendation; onrefresh: () => void }`
- Renders three landmark sections with `role="region"` and `aria-labelledby`
- Calls `logTodayImpression(...)` once inside `onMount` (not at module init—localStorage is unavailable during SSR)
- Has `today-surface.test-harness.svelte` and `today-surface.svelte.test.ts`

### `src/lib/components/recommendation-card.svelte` (new)

Props:

```typescript
interface Props {
	item: DrillRef | { type: 'placement-cta' } | { type: 'sequencer' | 'chord-lab'; reason: string };
	slot: TodaySlot;
	// For navigation items (DrillRef, placement-cta): provide href, render <a>.
	// For in-page action items (sequencer/chord-lab): omit href, render <button>.
	href?: string;
	onstart?: () => void;
}
```

- Renders: track badge (via `track-badge.svelte`), drill title or CTA label, reason text (`aria-describedby` target)
- For `DrillRef` and placement-cta items: renders `<a href={href}>` (not `<button>`) for correct keyboard semantics, right-click, and SvelteKit preload
- For sequencer/chord-lab items: renders `<button onclick={onstart}>` (in-page action, not navigation)
- `recommendation-card.svelte` writes `PENDING_DRILL_KEY` to localStorage before navigating via `href` for tracks that need specific drill config
- Template narrows the union using the `type` discriminant: `{#if item.type === 'drill'}…{:else if item.type === 'placement-cta'}…{:else}…{/if}`
- Has `recommendation-card.svelte.test.ts`

### `src/lib/components/track-badge.svelte` (new)

- Props: `{ track: TodayTrack }`
- Maps track identifiers to display labels and CSS custom-property-backed colors
- Stateless; tested via parent component tests

### `src/lib/components/app-header.svelte` (modified)

Add two nav links to the existing navigation structure (M16 added `/sequencer` and `/progression` links; M19 extends the same pattern):

- `<a href="/today">Today</a>` — placed before track-specific links
- `<a href="/docs">Guide</a>` — placed last

Both are native `<a>` elements (not `<button>` + `goto()`).

### Documentation routes (all new, all `prerender = true` via `+layout.ts`)

```
src/routes/docs/+layout.svelte                       — shared docs nav landmark
src/routes/docs/absolute-pitch/+page.svelte
src/routes/docs/relative-pitch/+page.svelte
src/routes/docs/teacher-workflow/+page.svelte
src/routes/docs/privacy/+page.svelte
src/routes/docs/accessibility/+page.svelte
src/routes/docs/microphone/+page.svelte
src/routes/docs/midi/+page.svelte
src/routes/docs/browser-support/+page.svelte
```

All documentation pages are plain `.svelte` files with inline semantic HTML prose (h1, h2, p, ul). No markdown plugin, no content-collection framework—eight pages do not earn that tooling cost. The `prerender = true` option is set once in `src/routes/docs/+layout.ts` and inherited by all children.

### Documentation minimum content requirements

**`/docs/absolute-pitch`**:

- Protocol summary adapted from Wong, Cheung, Ngan, and Wong 2025, with a citation linked to the Psychonomic Bulletin & Review article.
- Expected time commitment: up to 21.4 training hours and approximately 15,327 trials over eight weeks.
- Honest outcome caveats: "Results vary. Participants in the 2025 study averaged 7.08 of 12 pitches at 90%+ accuracy; two reached all 12."
- What this product trains versus what it does not claim.

**`/docs/privacy`**:

- Explicit list of what stays local: FSRS state, attempt log, preferences, assignments.
- Explicit list of what leaves the device: nothing in milestones 00–19; opt-in aggregate data collection begins no earlier than M21 (Anonymous Aggregate Efficacy), after the database boundary is introduced at M20.
- Statement that microphone audio is never stored or transmitted.
- Link to the local data export flow.
- Phrase "stays on your device" or equivalent must appear on the page.

**`/docs/browser-support`**:

- Audio: Chrome 66+, Firefox 76+, Safari 14.1+.
- Web MIDI: Chrome/Edge only; "not supported in Safari or Firefox" stated explicitly.
- Microphone: Chrome, Firefox, Safari (HTTPS required); iOS Safari limitations noted.
- At least one explicit minimum version number for each listed browser.

**`/docs/teacher-workflow`**:

- Step-by-step: create assignment link → share with students → student completes on their device → teacher receives exported CSV.
- Explicit statement: no student account, no school login, no cloud storage required.
- Extends the accountless assignment infrastructure delivered by M18.

## Dependencies

- **M11 — Relative Pitch and Singer Track**: Provides the relative-pitch and singer track drills and their FSRS analytics state. The Today supporting slot reads from M11's localStorage analytics to surface a relative-pitch due item when the learner is enrolled. M19 reads `vibratone:fsrs:relative-pitch:v1`; returns an empty-array reader when the key is absent.
- **M15 — Producer Track**: Provides the Producer drill library, FSRS analytics, and Web Audio nodes that the Today surface may surface as a supporting slot item. Producer track QA is owned by M15; M19 only routes to it. M19 reads `vibratone:fsrs:production:v1`; returns an empty-array reader when the key is absent.
- **M16 — Step Sequencer and Chord Progression Lab**: Provides the step sequencer at `/sequencer` and chord progression lab at `/progression` that serve as the Today free-play item. M19 links to these routes from the Today free-play slot; the features themselves are not rebuilt here.
- **M18 — Accountless Teacher and Assignment Exports**: Provides the accountless assignment and claims-and-evidence infrastructure that the teacher workflow documentation extends. The `/docs/teacher-workflow` page documents the M18 flow without rebuilding it.

## External Dependency Contracts

| Capability                                       | Owning Repo / Issue                                           | Contract Needed by M19                                                                      | Stub / Mock Plan                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Octavian progression primitives                  | octavian/issues/22                                            | `Progression` type used as the free-play item label for the chord-lab Today card            | Use the string literal `'Chord Progression Lab'` as the card label; replace with octavian #22 output when it ships                                                                                                                                                               |
| Cinder docs nav component                        | cinder / file issue if nav component is missing               | A keyboard-navigable `<nav>` link list for the docs layout                                  | Use a plain `<nav><ul><li><a>` structure; no Cinder dependency required for the stub                                                                                                                                                                                             |
| AP FSRS card state                               | M05 (`src/lib/learning/scheduling/ap-fsrs.ts`)                | localStorage key `vibratone:fsrs:ap:v1`; value type `Record<string, FsrsCard>`              | `buildReadersFromLocalStorage()` returns an empty-array AP reader when the key is absent; `composeToday` falls back to `{ type: 'placement-cta' }`                                                                                                                               |
| Relative-pitch FSRS state                        | M11                                                           | localStorage key `vibratone:fsrs:relative-pitch:v1`; same `FsrsCard` value shape            | Empty-array reader with `isEnrolled(): () => false` when key absent                                                                                                                                                                                                              |
| Theory FSRS state                                | M13 (Theory Explorers — not in M19's required dependency set) | localStorage key `vibratone:fsrs:theory:v1`                                                 | Empty-array reader with `isEnrolled(): () => false` when key absent. The theory reader is graceful: M19 works whether or not theory data is present. The Today surface surfaces theory due items automatically if M13 has written to this key; no M19 code changes are required. |
| Production FSRS state                            | M15                                                           | localStorage key `vibratone:fsrs:production:v1`; same `FsrsCard` value shape                | Empty-array reader with `isEnrolled(): () => false` when key absent                                                                                                                                                                                                              |
| AttemptEvent type and log key                    | M00 — `src/lib/learning/drills/schema.ts`                     | `import type { AttemptEvent } from '$lib/learning/drills'`; log key `vibratone:attempts:v1` | Already shipped. Used for the negative assertion: after free-play slot activation, `vibratone:attempts:v1` length must not increase                                                                                                                                              |
| `@axe-core/playwright`                           | npm (not a monorepo package)                                  | `AxeBuilder({ page }).analyze()` returning `{ violations }`                                 | No stub needed — install as a dev dependency before M19 e2e work begins: `bun add -d @axe-core/playwright`                                                                                                                                                                       |
| Playwright clock API (`page.clock.setFixedTime`) | Playwright ≥ 1.45; project already at `^1.60.0`               | `page.clock.setFixedTime(Date.now() + 31 * 60 * 1000)` for AC17 stale-refresh test          | No stub needed; available in the installed version                                                                                                                                                                                                                               |

## Acceptance Criteria

Each criterion is a concrete binary pass/fail:

1. **Today surface renders all three slots on first visit**: A Playwright test navigating to `/today` on a fresh localStorage state finds an AP placement CTA in the primary slot, an "Explore tracks" card in the supporting slot, and a step sequencer link in the free-play slot—with no JavaScript console errors.

2. **AP slot shows the most-overdue FSRS card**: A unit test seeding the FSRS state with two AP cards (one with `retrievability` near zero / due yesterday, one due next week) confirms `composeToday` returns the more-overdue card in `apItem`.

3. **AP slot returns placement CTA when no AP cards exist**: A unit test with an empty AP reader (no due items, no weak concepts) confirms `apItem` is `{ type: 'placement-cta' }`.

4. **Supporting slot is null when no non-AP track is enrolled**: A unit test where all non-AP readers return `isEnrolled(): false` confirms `supportingItem` is `null` and no weak-concept fallback is attempted.

5. **Supporting slot shows the correct enrolled track's card**: A unit test with AP and relative-pitch readers (both with due items) confirms `supportingItem` is a relative-pitch `DrillRef`.

5a. **Supporting slot shows weak-concept fallback for enrolled track with empty due queue**: A unit test with a relative-pitch reader where `isEnrolled()` is `true` but `getDueItems()` returns `[]` (and `getWeakConcepts()` returns one item) confirms `supportingItem` is the weak-concept `DrillRef`, not `null`.

5b. **Supporting slot returns null only when no non-AP track is enrolled**: A unit test where all non-AP readers return `isEnrolled(): false` confirms `supportingItem` is `null`.

6. **AP primary slot navigates to drill on click**: A Playwright test clicking the AP slot recommendation on `/today` navigates to `/` (the existing AP trainer route) and the drill loads without error.

7. **Free-play activation does not emit an `AttemptEvent`**: A unit test confirming that activating the free-play slot emits only a `TodaySelectionEvent` with `recommendationSlot: 'free-play'`—not an `AttemptEvent`.

8. **Today surface is keyboard navigable**: A Playwright test tabs through the three Today slots and activates the primary slot using Enter—confirms focus order, activation, and that focus is not trapped after the last slot.

9. **Today surface is announced by screen reader**: An axe-core accessibility assertion on `/today` reports zero violations in landmark, heading, and interactive-element categories.

10. **Analytics events include `sourceTrack` and `recommendationSlot` fields**: A unit test confirms that the event emitted when a Today slot is selected includes `sourceTrack` typed as `TodayTrack` and `recommendationSlot` typed as `TodaySlot` (camelCase).

11. **AP documentation includes research citation and caveats**: A Playwright test on `/docs/absolute-pitch` asserts the page includes the text "Wong" (citation anchor) and "variance" or "not all" or "averaged" (caveats language)—failing if either is absent.

12. **Privacy documentation names local-first posture**: A Playwright test on `/docs/privacy` confirms the page includes the phrase "stays on your device" or equivalent and a link to the data export flow.

13. **Browser support documentation names specific browsers and versions**: A Playwright test on `/docs/browser-support` confirms the page includes entries for Chrome, Firefox, and Safari, each with at least one explicit minimum version number.

14. **No feature requires auth, database, or billing**: (a) A unit test importing `src/lib/learning/scheduling/today.ts` confirms it does not import any server-side database client, auth session handler, or billing SDK. (b) The Playwright e2e suite passes with no server running beyond the SvelteKit static adapter.

15. **Responsive smoke passes at all three widths**: A Playwright test runs the full Today → drill-start flow at 375 px, 768 px, and 1280 px using `page.setViewportSize()` inside the test and passes without layout overflow, hidden interactive targets, or console errors.

16. **Documentation pages prerender without JS**: A Playwright test across all eight docs routes with JavaScript disabled confirms meaningful content is visible (an h1 and at least one paragraph) on each route.

17. **Today surface stale-recommendation refresh**: A Playwright test that uses `page.clock.setFixedTime` to advance time by 31 minutes confirms the Today page shows a "Refresh recommendations" button, and clicking it recomposes without a full navigation.

**Success metric** (manual or CI-gated): A returning learner (AP placement done, at least one non-AP track enrolled—AP FSRS data and relative-pitch FSRS data both seeded in localStorage) can navigate from page load to the drill's first prompt within 30 seconds.

Named Playwright test: `today page — returning learner reaches first drill prompt within 30 seconds (seeded state)`. Precondition: seed AP FSRS data (one card due) and relative-pitch FSRS data (one card due) in localStorage; navigate to `/today`; click the AP primary slot; assert an element with `role="status"` or the play button is present and responsive. If AudioContext autoplay is unavailable in headless CI, mark this test manual-only with the note: "Run manually in Chrome with `--autoplay-policy=no-user-gesture-required`."

## Test Plan

### Unit tests — `src/lib/learning/scheduling/today.spec.ts`

- `composeToday — returns placement CTA when AP reader has no due items and no weak concepts`
- `composeToday — returns most-overdue AP card when multiple due cards exist (lowest retrievability wins)`
- `composeToday — returns null supportingItem when all non-AP readers report isEnrolled false`
- `composeToday — returns lowest-retrievability relative-pitch card as supportingItem when enrolled`
- `composeToday — returns weak-concept supportingItem when enrolled track has empty due queue`
- `composeToday — supportingItem tie-breaks by least weekly attempts when retrievability is equal across enrolled non-AP tracks`
- `composeToday — supportingItem tie-breaks alphabetically by track name when retrievability and weekly attempts are equal`
- `composeToday — surfaces a theory DrillRef as supportingItem when the theory reader has the most-overdue due item`
- `composeToday — surfaces a production DrillRef as supportingItem when the production reader has the most-overdue due item`
- `composeToday — returns chord-lab as freePlayItem when chord-lab weekly attempt count is lower`
- `composeToday — returns sequencer as freePlayItem by default (all attempt counts equal zero)`
- `composeToday — freePlayItem source is never fsrs-due or weak-concept`
- `composeToday — AP slot and supporting slot never reference the same drillId`
- `composeToday — composedAt is within 100 ms of Date.now() at call time`
- `composeToday — output is a plain object with no mutable state or side effects`
- `TODAY_STALE_AFTER_MS — equals 1800000 (30 minutes in milliseconds)`
- `isStale — returns false when composedAt is less than TODAY_STALE_AFTER_MS ago`
- `isStale — returns true when composedAt is exactly TODAY_STALE_AFTER_MS ago`
- `today module — does not import any database client, auth session handler, or billing SDK`

### Unit tests — `src/lib/learning/scheduling/today-readers.spec.ts`

- `resolveDrillRoute — returns "/" for ap track`
- `resolveDrillRoute — returns "/relative-pitch" for relative-pitch track`
- `resolveDrillRoute — returns "/theory" for theory track`
- `resolveDrillRoute — returns "/production" for production track`
- `resolveDrillRoute — returns "/sequencer" for free-play sequencer item`
- `resolveDrillRoute — returns "/progression" for free-play chord-lab item`
- `buildReadersFromLocalStorage — returns empty-array reader with isEnrolled false when FSRS key is absent`
- `buildReadersFromLocalStorage — returns reader with isEnrolled true when FSRS key has at least one card`

### Unit tests — `src/lib/learning/analytics/today-events.spec.ts`

All tests inject a `createMockStorage()` instance via the optional `storage` parameter; none rely on `localStorageOrNull()` directly (which returns `null` in the node test environment).

- `logTodayImpression — appends event with correct shape to injected storage`
- `logTodayImpression — caps log at 90 entries, discarding oldest when over limit`
- `logTodaySelection — appends selection event with sourceTrack, recommendationSlot, drillId, and source`
- `logTodaySelection — caps log at 90 entries, discarding oldest when over limit`
- `logTodaySelection — rejects unknown recommendationSlot values at the type level`
- `isTodayImpressionEvent — rejects payload missing required fields`
- `isTodaySelectionEvent — rejects payload with wrong field types`
- `free-play slot activation emits TodaySelectionEvent, not AttemptEvent`

### Component tests — `src/lib/components/today-surface.svelte.test.ts`

- `TodaySurface — renders three sections with correct ARIA landmark roles and accessible names`
- `TodaySurface — renders AP placement CTA in primary slot when apItem is placement-cta`
- `TodaySurface — renders drill title in primary slot when apItem is a DrillRef`
- `TodaySurface — renders null state for supportingItem with placeholder text "Nothing due right now—explore tracks"`
- `TodaySurface — calls logTodayImpression exactly once on mount`
- `TodaySurface — emits slot-selected event with correct sourceTrack and recommendationSlot on click`
- `TodaySurface — AP section appears first in document order`

### Component tests — `src/lib/components/recommendation-card.svelte.test.ts`

- `RecommendationCard — displays track badge, drill title, and reason text`
- `RecommendationCard — renders anchor element (not button) for DrillRef slot`
- `RecommendationCard — renders button element for free-play sequencer slot`
- `RecommendationCard — reason text is referenced by aria-describedby on the card`
- `RecommendationCard — anchor is keyboard-activatable with Enter and Space`
- `RecommendationCard — free-play slot renders no due-card language (no text matching /due|review|overdue/i)`

### Playwright e2e tests — `e2e/today-surface.e2e.ts`

Note: Playwright `testMatch` is `**/*.e2e.{ts,js}`. Files named `.spec.ts` are silently skipped—use `.e2e.ts`.

- `today page — fresh state shows AP placement CTA in primary slot`
- `today page — AP slot navigates to drill on click`
- `today page — keyboard navigation reaches all three slots in document order`
- `today page — Tab does not trap focus inside the Today surface`
- `today page — axe accessibility scan reports zero violations`
- `today page — fresh browser context with non-asset network blocked still renders all slots`
- `today page — stale recommendation shows Refresh button after 31-minute clock advance`
- `today page — Refresh button recomposes without full navigation`
- `today page — 375 px viewport shows all slots without horizontal overflow` (uses `page.setViewportSize`)
- `today page — 768 px viewport shows all slots without horizontal overflow` (uses `page.setViewportSize`)
- `today page — 1280 px viewport shows all slots without horizontal overflow` (uses `page.setViewportSize`)
- `today page — returning learner reaches first drill prompt within 30 seconds (seeded state)` (manual if headless AudioContext autoplay is unavailable)

**Responsive testing strategy**: Use `page.setViewportSize()` inside each viewport-specific test rather than global Playwright config projects. Global projects would run all ~25 tests (including 8 docs axe scans) at every width unnecessarily, tripling CI time. The three viewport tests already in this list give targeted coverage.

### Playwright e2e tests — `e2e/launch-docs.e2e.ts`

- `docs/absolute-pitch — page includes Wong citation`
- `docs/absolute-pitch — page includes outcome variance language (averaged or not all)`
- `docs/absolute-pitch — page includes expected time commitment (21 or 15,327 or eight weeks)`
- `docs/privacy — page includes local-first posture statement (stays on your device or equivalent)`
- `docs/privacy — page includes link to data export flow`
- `docs/browser-support — page includes Chrome, Firefox, and Safari entries with version numbers`
- `docs/teacher-workflow — page includes accountless assignment steps`
- `docs/midi — page includes Safari/iOS unsupported fallback notice`
- `docs/microphone — page includes getUserMedia permission guidance`
- `app-header — Today and Guide links are keyboard-reachable with Tab from any route`
- `docs layout nav — all eight doc links are keyboard-reachable with Tab`
- `docs — all internal links resolve to existing routes (no 404)`
- `docs — heading hierarchy has no skipped levels`
- `docs — no missing alt text on any images`
- `docs/absolute-pitch — axe accessibility scan reports zero violations`
- `docs/relative-pitch — axe accessibility scan reports zero violations`
- `docs/teacher-workflow — axe accessibility scan reports zero violations`
- `docs/privacy — axe accessibility scan reports zero violations`
- `docs/accessibility — axe accessibility scan reports zero violations`
- `docs/microphone — axe accessibility scan reports zero violations`
- `docs/midi — axe accessibility scan reports zero violations`
- `docs/browser-support — axe accessibility scan reports zero violations`
- `docs/absolute-pitch — page renders meaningful content with JavaScript disabled`
- `docs/relative-pitch — page renders meaningful content with JavaScript disabled`
- `docs/teacher-workflow — page renders meaningful content with JavaScript disabled`
- `docs/privacy — page renders meaningful content with JavaScript disabled`
- `docs/accessibility — page renders meaningful content with JavaScript disabled`
- `docs/microphone — page renders meaningful content with JavaScript disabled`
- `docs/midi — page renders meaningful content with JavaScript disabled`
- `docs/browser-support — page renders meaningful content with JavaScript disabled`

Axe scans and no-JS tests can each be implemented as a `test.each` over the eight doc slugs to reduce boilerplate while keeping individual test names visible in CI output.

### Acceptance criterion → test mapping

| AC                                                | Named Test(s)                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 — Today renders all three slots               | `today page — fresh state shows AP placement CTA in primary slot`                                                                                                                                                                                                                                                       |
| AC2 — AP slot returns most-overdue card           | `composeToday — returns most-overdue AP card when multiple due cards exist`                                                                                                                                                                                                                                             |
| AC3 — AP slot returns placement CTA               | `composeToday — returns placement CTA when AP reader has no due items and no weak concepts`                                                                                                                                                                                                                             |
| AC4 — Supporting slot null when no track enrolled | `composeToday — returns null supportingItem when all non-AP readers report isEnrolled false`                                                                                                                                                                                                                            |
| AC5 — Supporting slot shows correct track         | `composeToday — returns lowest-retrievability relative-pitch card as supportingItem when enrolled`; `composeToday — surfaces a theory DrillRef as supportingItem`; `composeToday — surfaces a production DrillRef as supportingItem`; `composeToday — supportingItem tie-breaks by least weekly attempts`               |
| AC5a — Supporting slot weak-concept fallback      | `composeToday — returns weak-concept supportingItem when enrolled track has empty due queue`                                                                                                                                                                                                                            |
| AC5b — Supporting slot null only when unenrolled  | `composeToday — returns null supportingItem when all non-AP readers report isEnrolled false`                                                                                                                                                                                                                            |
| AC6 — AP slot navigates to drill                  | `today page — AP slot navigates to drill on click`                                                                                                                                                                                                                                                                      |
| AC7 — Free-play does not emit AttemptEvent        | `free-play slot activation emits TodaySelectionEvent, not AttemptEvent`                                                                                                                                                                                                                                                 |
| AC8 — Today surface keyboard navigable            | `today page — keyboard navigation reaches all three slots`; `today page — Tab does not trap focus`                                                                                                                                                                                                                      |
| AC9 — Screen-reader accessibility                 | `today page — axe accessibility scan reports zero violations`                                                                                                                                                                                                                                                           |
| AC10 — Analytics event fields                     | `logTodaySelection — appends selection event with sourceTrack, recommendationSlot, drillId, and source`; `logTodaySelection — caps log at 90 entries`                                                                                                                                                                   |
| AC11 — AP docs citation and caveats               | `docs/absolute-pitch — page includes Wong citation`; `docs/absolute-pitch — page includes outcome variance language`                                                                                                                                                                                                    |
| AC12 — Privacy local-first posture                | `docs/privacy — page includes local-first posture statement`; `docs/privacy — page includes link to data export flow`                                                                                                                                                                                                   |
| AC13 — Browser support version numbers            | `docs/browser-support — page includes Chrome, Firefox, and Safari entries with version numbers`                                                                                                                                                                                                                         |
| AC14 — No auth/database/billing                   | `today module — does not import any database client, auth session handler, or billing SDK`; `today page — fresh browser context with non-asset network blocked still renders all slots`                                                                                                                                 |
| AC15 — Responsive smoke                           | `today page — 375/768/1280 px viewport` tests                                                                                                                                                                                                                                                                           |
| AC16 — Docs prerender without JS                  | All 8 `docs/[slug] — page renders meaningful content with JavaScript disabled` tests                                                                                                                                                                                                                                    |
| AC17 — Stale refresh                              | `today page — stale recommendation shows Refresh button after 31-minute clock advance`; `today page — Refresh button recomposes without full navigation`; `isStale — returns true when composedAt is exactly TODAY_STALE_AFTER_MS ago`; `isStale — returns false when composedAt is less than TODAY_STALE_AFTER_MS ago` |
| Success metric — <30s to first prompt             | `today page — returning learner reaches first drill prompt within 30 seconds (seeded state)` (manual if headless AudioContext autoplay is unavailable)                                                                                                                                                                  |
| Docs axe requirement                              | `docs/[slug] — axe accessibility scan reports zero violations` × 8                                                                                                                                                                                                                                                      |

## Verification

```bash
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

**Manual checks**:

- Navigate to `/today` in Chrome and Safari on desktop. Confirm all three slots display, the AP slot link resolves to a working drill, and no console errors appear.
- Navigate to `/today` in a mobile Chrome emulation at 375 px. Confirm all slots are visible without scrolling horizontally.
- Navigate to `/docs/absolute-pitch`. Confirm the Wong 2025 citation is present and the honest-caveats paragraph appears in the first screenful.
- Navigate to `/docs/browser-support`. Confirm the MIDI unsupported note for Safari/Firefox is present.
- Tab through the Today surface using a keyboard only. Confirm focus reaches all three slots and Tab exits to the header after the free-play slot.
- Run the 30-second drill-start test manually in Chrome with `--autoplay-policy=no-user-gesture-required` if it was skipped in headless CI.

**Producer track integration smoke** (integration, not new development—M15 owns QA):

- Confirm the Today supporting slot can surface a Producer drill reference by seeding mock Producer FSRS data (`vibratone:fsrs:production:v1`) in localStorage and reloading `/today`.
- Confirm clicking the Producer drill link from Today navigates to `/production` without console errors.

## Non-Goals

- Do not build Producer drill parameter logic, EQ node wiring, or compression detection here. That is M15 scope.
- Do not build the step sequencer keyboard controls, lookahead scheduler, or chord lab playback here. That is M16 scope.
- Do not add DAW features to the step sequencer—M16's scope decision is inherited, not extended.
- Do not add a markdown processing pipeline for documentation. Eight static pages do not earn that tooling cost.
- Do not define an enrollment management UI in this milestone. Enrollment is inferred from `isEnrolled()` on `TrackAnalyticsReader` (at least one lifetime attempt recorded). A dedicated "manage enrolled tracks" surface is out of scope for M19.
- Do not add auth, billing, cloud sync, or a database.
- Do not publish aggregate efficacy reports—that moves behind the database milestone (M20).
- Do not bundle large sample libraries into the main app.
- Do not add native mobile applications.
- Do not turn the Today surface into a full dashboard with graphs, streaks, or detailed analytics—those belong to the analytics and database milestones.

## Completion Signal

This milestone is complete when a returning learner can start a recommended drill from the unified Today surface without navigating to a track-specific page, all four tracks are reachable from a single launch-state UI, and launch documentation covering AP, privacy, browser support, accessibility, and teacher workflow is live at `/docs`—all without auth, a database, or cloud sync.

Specifically:

- `bun run test:unit -- --run` passes all named unit tests in `today.spec.ts`, `today-readers.spec.ts`, and `today-events.spec.ts`.
- `bun run test:e2e` passes all specs in `today-surface.e2e.ts` and `launch-docs.e2e.ts` (note `.e2e.ts` extension required by the repo's `testMatch` pattern).
- Every documentation page in `/docs` passes an axe-core scan with zero violations.
- The `bun run check` and `bun run lint` commands report zero errors.

**Kill criterion**: If 3 or more of 5 user-testing participants cannot identify which item to practice first from the Today surface without facilitator help, the recommendation algorithm must be revised before M20 (Database Foundation) begins. Do not proceed to the database milestone with a Today surface that does not orient the learner.
