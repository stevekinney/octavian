# 09. Public AP Beta and Proof Loop

## Outcome

Launch the AP wedge publicly with honest claims, an opt-in eight-week program, a deterministic daily puzzle with Wordle-style result sharing, individual proof of learning from local data only, and a visible research-mode toggle—all without accounts or a database.

## Product Requirements

### AP Landing as Primary Entry

The root route (`/`) becomes the AP beta landing page. It replaces the current single-note trainer as the primary product entry point. It renders the AP program promise, an honest-caveat statement, the expected time commitment (~8 weeks, ~21 hours), a primary CTA to start the daily puzzle, and a link to the claims/evidence page.

The existing single-note trainer (`src/routes/+page.svelte`) moves to `src/routes/(ap)/train/+page.svelte`. The URL changes from `/` to `/train`. Update any internal links accordingly. The trainer page inherits the `(ap)` layout, including the Research Mode badge and context providers.

The landing and all AP public surfaces live under `src/routes/(ap)/`, so the `(ap)/+layout.svelte` context providers (Research Mode state, AP Program state) reach every surface including the landing. Route groups do not change URLs: `(ap)/+page.svelte` serves `/`, `(ap)/puzzle/+page.svelte` serves `/puzzle`, etc.

### Daily Puzzle

The daily puzzle is seeded deterministically by UTC calendar date. Every visitor—including first-time visitors who have never completed placement—on the same UTC calendar date receives the same puzzle. Day rollover uses UTC midnight. The puzzle is playable cold with no placement requirement and no account.

**Seed derivation:** The puzzle's `puzzleId` is the ISO date string for today in UTC, e.g. `'2026-06-07'`. It is derived once in a universal `+page.ts` `load` function (runs on both server and client) so server and client agree without straddling midnight:

```ts
// src/routes/(ap)/puzzle/+page.ts
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const puzzleId = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
	return { puzzleId };
};
```

The component reads `data.puzzleId`; it never derives the puzzle ID at render time or in a `$derived`.

**Puzzle structure:**

- 12 single-note pitch-class prompts drawn from a seeded PRNG using the `puzzleId` string as seed.
- Octave is randomized per prompt from the three trained octaves.
- One attempt per prompt; no replay within the puzzle session.
- Scoring: correct / 12.
- A new visitor can start the puzzle immediately—the puzzle gate must not check for placement or enrollment.

**Cross-timezone caveat:** A learner at 11:58 PM UTC+10 and one at 12:01 AM UTC share a puzzle within one minute after UTC rollover. This is intentional and acceptable. The claims/evidence page documents this behavior.

**Share payload schema (allowlist—no other fields permitted):**

```typescript
interface DailyPuzzleSharePayload {
	schemaVersion: '1';
	puzzleDate: string; // YYYY-MM-DD UTC, same as puzzleId
	correct: number; // 0–12
	total: 12;
	attemptSequence: string; // emoji string, one character per prompt: 🟩 correct, 🟥 wrong
}
```

The privacy filter enforces this allowlist at serialization time. No raw `AttemptEvent` fields, no `responseTimesMs`, no note names, no MIDI values, no octave history, and no FSRS state appear in the share payload. A unit test named `'share payload contains only allowlisted fields'` asserts `Object.keys(payload)` equals exactly `['schemaVersion', 'puzzleDate', 'correct', 'total', 'attemptSequence']`.

**Share text format** (for `navigator.share` / clipboard):

```
Vibratone AP Puzzle · 2026-06-07
🟩🟥🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩
10/12
https://vibratone.app/puzzle
```

Emoji map: U+1F7E9 (correct), U+1F7E5 (wrong). The share string must contain no note name, pitch class number, or MIDI value matching any target note.

**DailyPuzzleResult** (local storage only, never shared):

```typescript
type DailyPuzzleResult = {
	version: 1;
	puzzleId: string; // YYYY-MM-DD
	completedAt: number; // Date.now()
	correct: number;
	total: 12;
	responseTimesMs: number[]; // per-prompt; feeds progress report, never share payload
};
```

Stored under `vibratone:daily-puzzle:v1`. A new puzzle date overwrites the previous entry. `responseTimesMs` is used only by the individual progress report.

**Share implementation:** Web Share API with clipboard fallback, no third-party library. The share function lives in `src/lib/learning/analytics/share.ts` and is called from an `onclick` handler (never from `$effect` or `onMount`). The share button exposes its outcome via `aria-live="polite"` so screen readers announce "Copied to clipboard" or "Shared."

### Research Mode

Research mode is a persistent session toggle, stored under `vibratone:research-mode` in `localStorage` and initialized SSR-safely via `localStorageOrNull()` + `loadJSON`. When active, all five protocol properties change relative to their defaults:

| Property                      | Default                   | Research Mode                |
| ----------------------------- | ------------------------- | ---------------------------- |
| Response window               | Level-defined, extendable | Level minimum, no extension  |
| Feedback after answer         | Enabled                   | Disabled                     |
| Octave spacing                | Current level default     | Randomized across ≥3 octaves |
| Reference pitch before prompt | Configurable              | Suppressed                   |
| Prompt timbre                 | Learner-trained timbre    | Untrained timbre from pool   |

A persistent badge labeled **Research Mode** renders in the app header whenever the mode is active—not only on the drill screen. Toggling research mode off restores all five properties to their default values. The toggle state survives page reload.

### Eight-Week AP Program

Opting into the eight-week program stores the following locally under `vibratone:ap-program:v1`:

- `programStartDate`: ISO date string of opt-in day (YYYY-MM-DD).
- `weeklySessionTarget`: integer, default 5.

No server call is made at opt-in or at any subsequent program milestone. Opting out clears `programStartDate` but does not delete attempt history, FSRS state, or analytics.

**Today surface while enrolled shows:**

- Week number in program (derived from `programStartDate` and current date; clamped at 8 once 56+ days have elapsed).
- Sessions completed this week.
- Pitches currently held at ≥90% cold-test accuracy.

### Individual Progress Report

The progress report is generated from local data only—no network call—and is generatable at any time, not only at week 8. Each dimension has a minimum-data requirement and a graceful-degradation fallback:

| Dimension            | Source                                                          | Minimum data             | Fallback when insufficient                      |
| -------------------- | --------------------------------------------------------------- | ------------------------ | ----------------------------------------------- |
| Cold-test accuracy   | `vibratone:attempts:v1` filtered by `referenceAvailable: false` | 3+ cold-test sessions    | "Not enough cold-test sessions yet (need 3)"    |
| Response-time change | All non-placement attempts                                      | 3+ timed sessions        | "Need more timed sessions"                      |
| Transfer gap         | Transfer-timbre vs. trained-timbre attempts (milestone 07 data) | 1+ transfer-test session | "Transfer data available after register branch" |
| Pitch count at ≥90%  | Level-progression mastery state (milestone 06)                  | 1+ session               | Always renderable (0 if no data)                |
| Retention trend      | FSRS-forecast recall in cold tests                              | 5+ sessions              | "Need more sessions to show trend"              |

When no transfer-timbre attempts exist, `transferGap` is `null` (not `NaN`, not `undefined`). Each null/insufficient field shows its corresponding placeholder string in the UI.

**`IndividualProgressReport` type** (in `src/lib/learning/analytics/report.ts`):

```typescript
export type IndividualProgressReport = {
	generatedAt: number;
	coldTestAccuracy: number | null; // null if < 3 cold sessions
	responseTimeDeltaMs: number | null; // null if < 3 timed sessions
	transferGap: number | null; // null if no transfer-timbre attempts
	pitchCountLearned: number; // always present; 0 if no data
	retentionTrend: number | null; // null if < 5 sessions
};
```

**Aggregator signature:**

```typescript
export type ProgressReportInput = {
	attempts: AttemptEvent[];
	masteredPitchCount: number; // from M06 mastery state; 0 when absent
	fsrsForecast: FsrsForecast | null; // from M05 FSRS state; null when absent
};

export function generateProgressReport(input: ProgressReportInput): IndividualProgressReport;
```

The function is pure—no `localStorage` access. The `/progress` route loads all three pieces from `localStorage` in `onMount` via `loadJSON` and passes them as a single input object. This keeps the aggregator fully testable with injected fixture data and makes the data-source contract explicit: `attempts` carries cold-test and transfer events; `masteredPitchCount` is the integer from the M06 mastery key; `fsrsForecast` is the FSRS recall forecast from the M05 FSRS key. When M05 or M06 data is absent, `onMount` passes `null` / `0` as documented stubs.

`FsrsForecast` is the type exported by the FSRS module from milestone 05. If milestone 05 is not complete, accept `fsrsForecast: null` and render the retention-trend insufficient-data placeholder.

### Claims and Evidence Page

The claims/evidence page is prerendered (static HTML). It must contain all of the following; absence of any item is a test failure:

1. A statement that AP acquisition is not guaranteed for every adult.
2. The Wong, Cheung, Ngan, and Wong 2025 citation (Psychonomic Bulletin & Review).
3. The specific result: participants averaged 7.08 pitches named at 90%+ accuracy (out of 12); two participants reached all 12.
4. The expected commitment: approximately 8 weeks and approximately 21 hours.
5. No language asserting certainty of outcome (the word "guaranteed" must not appear in any claims section).

The AP landing page sub-headline must also include honest-caveat language. "Serious and honest" is the brand; the caveat is not buried only on the internal claims page.

### Honest-AP Claims Guard

The existing grep gate from milestone 00 must continue to return no matches:

```
grep -rE "perfect pitch|guaranteed|will learn" src/
```

This gate is part of the Verification section and must pass on every CI run.

## User Experience Requirements

- The root route renders the AP promise, honest-caveat, and expected time commitment all visible in the initial viewport without scrolling or any interaction—at desktop (1280×800), tablet (768×1024), and phone (375×667) widths.
- A first-time visitor can play the daily puzzle without completing placement, creating an account, or enrolling in the eight-week program.
- A learner can share a daily puzzle result without an account creation prompt interrupting the flow.
- The Research Mode badge is visible in the page header at all times while research mode is active—not scoped to the drill screen.
- The opt-in eight-week program UX makes the commitment (~8 weeks, ~21 hours, ~5 sessions/week) explicit before the learner confirms. No server call is made during opt-in.
- The individual progress report is generatable from the progress page at any time, renders from local data only, and does not prompt for sign-in.
- The daily puzzle share flow announces its outcome (shared, copied to clipboard, or failed) via an `aria-live` region.

## Data and Analytics Requirements

- The `DailyPuzzleResult` is written to `vibratone:daily-puzzle:v1` on puzzle completion. A new puzzle date overwrites the previous entry.
- The `DailyPuzzleSharePayload` contains exactly five fields: `schemaVersion`, `puzzleDate`, `correct`, `total`, `attemptSequence`. No other fields are permitted.
- The individual progress report reads from `vibratone:attempts:v1`, FSRS state, and level-progression mastery state—all from `localStorage`. No network request is made.
- `responseTimesMs` from `DailyPuzzleResult` feeds the progress report's response-time dimension but is never included in the share payload.
- Research mode toggle state is stored under `vibratone:research-mode` and survives page reload.
- Eight-week program state is stored under `vibratone:ap-program:v1` with fields `programStartDate` (ISO string) and `weeklySessionTarget` (integer).
- Opt-out of the eight-week program clears `programStartDate` from `vibratone:ap-program:v1` but does not touch `vibratone:attempts:v1`, FSRS state, or mastery state.

## Accessibility Requirements

- The daily puzzle must be fully operable via keyboard only (Tab to focus, Enter/Space to submit answers, Tab to reach the share button).
- Every prompt and feedback state in the daily puzzle must have an accessible label readable by a screen reader.
- The share card renders as an HTML element with `role="img"` and an `aria-label` containing the full score summary. A visually hidden table provides per-prompt row labels (correct/incorrect) as a text alternative to the emoji grid.
- The research-mode toggle is a native `<input type="checkbox">` with an explicit accessible name and `role="switch"`.
- The claims/evidence page conveys all content as text; no chart or figure is the sole carrier of a claim (every `<canvas>` or `<svg>` must have an `aria-label` or adjacent text alternative).
- Opt-in controls for the eight-week program have explicit accessible labels and are reachable via Tab; focus is trapped inside any opt-in dialog and Escape closes it.
- All new routes pass Playwright keyboard-navigation checks at 1280×800.

## Module and Architecture Targets

### Routes

All AP public surfaces live under the `(ap)` route group. Route groups do not appear in URLs: `(ap)/+page.svelte` serves `/`, `(ap)/puzzle/+page.svelte` serves `/puzzle`, and so on. The root `+layout.svelte` is unchanged.

| File                                    | Action                                  | Purpose                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/(ap)/+layout.svelte`        | **Create**                              | Shared layout for all AP public surfaces. Renders `{@render children()}`. Creates `ResearchModeState` and `APProgramState` via their factory functions, sets them in context via `createContext` pairs, and renders the Research Mode badge in the page header when the mode is active.                                                                                                                       |
| `src/routes/(ap)/+page.svelte`          | **Create** (replaces root)              | AP beta landing page at `/`: promise, honest-caveat, time commitment, CTA to daily puzzle, link to claims/evidence page, opt-in program CTA. Inherits the `(ap)` layout and its context providers.                                                                                                                                                                                                            |
| `src/routes/(ap)/train/+page.svelte`    | **Move from** `src/routes/+page.svelte` | The existing single-note trainer relocated to `/train`. Update any internal links that referenced `/`. No feature changes to the trainer in this milestone.                                                                                                                                                                                                                                                   |
| `src/routes/(ap)/puzzle/+page.ts`       | **Create**                              | Universal `load` function returning `{ puzzleId: string }` derived from `new Date().toISOString().slice(0, 10)`. Never uses server-only code; safe in SSR.                                                                                                                                                                                                                                                    |
| `src/routes/(ap)/puzzle/+page.svelte`   | **Create**                              | Daily puzzle UI at `/puzzle`. Reads `data.puzzleId`, calls `createPuzzleState(puzzleId)`, persists `DailyPuzzleResult` on completion, renders share card and share action. Calls `onDestroy(() => state.destroy())`.                                                                                                                                                                                          |
| `src/routes/(ap)/progress/+page.svelte` | **Create**                              | Individual progress report at `/progress`. In `onMount`, loads `AttemptEvent[]` from `vibratone:attempts:v1`, `masteredPitchCount` from the M06 mastery key (stub: 0), and `fsrsForecast` from the M05 FSRS key (stub: null), then calls `generateProgressReport({ attempts, masteredPitchCount, fsrsForecast })`. Renders five metric dimensions with graceful-degradation placeholders. No network request. |
| `src/routes/(ap)/claims/+page.svelte`   | **Create**                              | Claims and evidence page at `/claims`. Static content; imports from `src/lib/data/ap-citations.ts`.                                                                                                                                                                                                                                                                                                           |
| `src/routes/(ap)/claims/+page.ts`       | **Create**                              | `export const prerender = true;`                                                                                                                                                                                                                                                                                                                                                                              |
| `src/routes/(ap)/program/+page.svelte`  | **Create**                              | Eight-week opt-in flow at `/program`. Reads/writes `vibratone:ap-program:v1` via `APProgramState` from context. No server call.                                                                                                                                                                                                                                                                               |

### Library Modules

| File                                                 | Action     | What lands there                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/learning/protocols/puzzle-state.svelte.ts`  | **Create** | `createPuzzleState(puzzleId: string)` factory. Mirrors the `createPracticeState` pattern: `$state` fields, action functions, `destroy()` for timer teardown. Uses `getSynth()` inside user-gesture handlers only. Reads the seeded PRNG to generate prompt sequence.                                                                                                                        |
| `src/lib/learning/protocols/research-mode.svelte.ts` | **Create** | `createResearchModeState()` factory. `$state` boolean `enabled`, initialized from `localStorageOrNull()` + `loadJSON`. `toggle()` action persists to `vibratone:research-mode`. Exported types: `ResearchModeState`.                                                                                                                                                                        |
| `src/lib/learning/protocols/ap-program.svelte.ts`    | **Create** | `createAPProgramState()` factory. `$state` fields: `programStartDate: string \| null`, `weeklySessionTarget: number`. `$derived` `weekNumber`. Actions: `enroll(today: string)`, `optOut()`. Persists to `vibratone:ap-program:v1` via `saveJSON`/`loadJSON`. Never uses module-level state (SSR-leak risk).                                                                                |
| `src/lib/learning/analytics/share.ts`                | **Create** | `buildSharePayload(result: DailyPuzzleResult): DailyPuzzleSharePayload`. `filterSharePayload(payload: unknown): DailyPuzzleSharePayload` (enforces allowlist). `encodeShareText(payload: DailyPuzzleSharePayload): string`. `shareResult(payload: DailyPuzzleSharePayload): Promise<'shared' \| 'copied' \| 'failed'>` (Web Share API + clipboard fallback; must be called from `onclick`). |
| `src/lib/learning/analytics/report.ts`               | **Create** | `generateProgressReport(input: ProgressReportInput): IndividualProgressReport`. `ProgressReportInput` carries `{ attempts: AttemptEvent[]; masteredPitchCount: number; fsrsForecast: FsrsForecast \| null }`. Pure function; no storage access; all three data sources injected so tests use fixture values directly.                                                                       |
| `src/lib/data/ap-citations.ts`                       | **Create** | `readonly` TypeScript const array of citation objects for the claims/evidence page. No load function needed.                                                                                                                                                                                                                                                                                |
| `src/lib/persistence.ts`                             | **Modify** | Add storage key constants: `RESEARCH_MODE_KEY = 'vibratone:research-mode'`, `AP_PROGRAM_KEY = 'vibratone:ap-program:v1'`, `DAILY_PUZZLE_KEY = 'vibratone:daily-puzzle:v1'`. Add type guards: `isDailyPuzzleResult`, `isAPProgramState`.                                                                                                                                                     |

### Components

| File                                             | Action     | Purpose                                                                                                                                                                                                             |
| ------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/share-card.svelte`           | **Create** | Accepts `{ result: DailyPuzzleResult; shareText: string }`. Renders `role="img"` with `aria-label` containing full score summary. Emoji grid supplemented by visually hidden `<table>` with per-attempt row labels. |
| `src/lib/components/research-mode-toggle.svelte` | **Create** | Native `<input type="checkbox">` with `role="switch"` bound to `ResearchModeState.enabled`. Renders visible indicator text when active. Keyboard and screen-reader usable.                                          |

### New Types

All types live in the files listed above. Types that belong to the shared drill contract go in `src/lib/learning/drills/types.ts` (established in milestone 00). Analytics and protocol types stay in their respective modules.

**SSR and Storage Invariants (all new files must observe):**

- No `window`, `document`, `localStorage`, or `navigator` references at module initialization time.
- All storage calls use `localStorageOrNull()` from `persistence.ts`.
- Universal `+page.ts` load functions run on server and client and must not reference browser globals.
- New storage keys follow the `vibratone:*` namespace.
- `navigator.share()` and `navigator.clipboard.writeText()` are called inside `onclick` handlers only—never in `$effect` or `onMount`.
- Audio playback on the puzzle page uses the shared `getSynth()` singleton from `src/lib/audio.ts`, called synchronously inside the user-gesture handler. Never call `getSynth()` in `onMount`, `$effect`, or at module scope.

## Dependencies

- **Milestone 07 (Timbre Transfer and Register Training):** The individual progress report's transfer-gap dimension consumes transfer-timbre vs. trained-timbre `AttemptEvent` data established in milestone 07. The daily puzzle itself does not require milestone 07—it runs on pitch-class identification alone. When milestone 07 data is absent, the transfer-gap dimension renders its insufficient-data placeholder (resolved by the graceful-degradation spec above; no dangling conditional).
- **Milestone 00 (Drill Schema, Attempt Event Log, and Note Trainer Conversion):** Provides the `AttemptEvent` type, `vibratone:attempts:v1` log key, `localStorageOrNull`, `loadJSON`/`saveJSON` helpers, seeded-random convention, and audio singleton pattern that all new modules follow.
- **Milestone 05 (Local FSRS and AP Analytics):** Provides FSRS state read by the retention-trend dimension of the progress report.
- **Milestone 06 (Research-Derived AP Level Progression):** Provides level-progression mastery state consumed by the pitch-count-at-≥90% dimension. If milestone 06 is not complete, the pitch-count field stubs to `0` via `loadJSON(localStorageOrNull(), AP_LEVEL_KEY, { masteredPitchClasses: [] }, isAPLevelState)`.

## External Dependency Contracts

### Cinder Share Card (Cinder issue #322)

**Capability:** A styled `ShareCard` surface accepting typed share payload props and a `ShareButton` triggering share/copy actions.

**Owner:** Cinder (`@lostgradient/cinder`), issue [#322](https://github.com/stevekinney/cinder/issues/322).

**Contract needed:** `ShareCard` accepting `{ title: string; summary: string; emojiGrid: string; ariaLabel: string }` and a `ShareButton` accepting `{ payload: string; label: string }`.

**Stub plan:** Implement `src/lib/components/share-card.svelte` as a local Svelte 5 component using a styled `<div role="img">` with `aria-label` for the card surface and `shareResult()` from `learning/analytics/share.ts` for the action. Component tests use the local stub unconditionally. Replace with Cinder components when #322 ships.

### Octavian Seeded Random (Octavian issue #28)

**Capability:** `seededRandomInt(seed: string): () => number`—a deterministic PRNG seeded by a string.

**Owner:** Octavian, issue [#28](https://github.com/stevekinney/octavian/issues/28).

**Contract needed:** Given the same `YYYY-MM-DD` date string as seed, produces identical prompt sequences across independent calls and independent environments.

**Stub plan:** A local `src/lib/learning/protocols/seeded-random.ts` implementing mulberry32 (the same pattern established in milestone 00). Already available if milestone 00 introduced it; reference it directly. No additional stub needed if the file exists.

## Acceptance Criteria

- **AC-1:** The root route (`/`) renders a primary AP entry CTA and a visible honest-caveat statement before any interaction, at 1280×800, 768×1024, and 375×667 viewports without scrolling. A Playwright spec asserts both elements are present and visible in the initial viewport.

- **AC-2:** The claims/evidence page (`/claims`) contains the Wong et al. 2025 citation string, the "7.08 pitches" result, the "~21 hours" commitment, and no guarantee language. A Playwright spec asserts all four conditions. The word "guaranteed" must not appear in any claims section.

- **AC-3:** All visitors on the same UTC calendar date receive identical daily-puzzle prompt sequences, with no placement or account required. A unit test asserts two independent calls with the same date seed produce identical prompt arrays.

- **AC-4:** A visitor can complete the daily puzzle and generate a share payload without an account creation prompt. A Playwright spec asserts the share flow completes without navigating to a sign-up route. A separate Playwright spec asserts the full puzzle + report flow works with all non-asset network requests blocked.

- **AC-5:** The share payload contains exactly the five allowlisted fields (`schemaVersion`, `puzzleDate`, `correct`, `total`, `attemptSequence`) and no others. A unit test asserts `Object.keys(payload)` equals exactly this list.

- **AC-6:** Activating research mode sets all five protocol properties to their strict values; deactivating restores defaults. A unit test asserts this with named property checks.

- **AC-7:** The Research Mode badge is visible in the page header when research mode is enabled, and absent when disabled. A Playwright spec asserts both states.

- **AC-8:** Opting into the eight-week program stores `programStartDate` in `localStorage` under `vibratone:ap-program:v1` and makes zero outbound network requests during the opt-in interaction. A Playwright spec intercepts non-asset network calls during opt-in and asserts zero fire.

- **AC-9:** Opting out of the eight-week program clears `programStartDate` but does not clear FSRS state or attempt history. A unit test asserts this by checking that `vibratone:attempts:v1` and FSRS state remain intact after `optOut()`.

- **AC-10:** The individual progress report renders an insufficient-data placeholder for each dimension that lacks minimum data; renders the metric when minimum data is present. A unit test covers both states for each of the five dimensions.

- **AC-11:** The daily puzzle is fully keyboard operable and each prompt and feedback state has an accessible label. A Playwright spec completes a full puzzle session using keyboard-only navigation and checks accessible labels.

## Test Plan

### Unit Tests

**`src/lib/learning/protocols/puzzle-state.spec.ts`**

- `'daily puzzle generates identical prompt sequence for the same UTC date across independent calls'`
- `'daily puzzle generates different prompt sequences for different UTC dates'`
- `'daily puzzle puzzleId equals the YYYY-MM-DD UTC date string passed as seed'`
- `'createPuzzleState returns exactly 12 prompts'`
- `'createPuzzleState destroy() clears the auto-advance timer without error'`

**`src/lib/learning/analytics/share.spec.ts`**

- `'share payload contains only allowlisted fields'`
- `'share payload serializes correct attempt sequence for a perfect score'`
- `'share payload serializes correct attempt sequence for a zero score'`
- `'share payload attemptSequence contains no note name, pitch class number, or MIDI value'`
- `'filterSharePayload strips responseTimesMs and any field not in the DailyPuzzleSharePayload contract'`
- `'encodeShareText output contains the puzzle date on the first line'`
- `'encodeShareText output contains the emoji grid on the second line'`
- `'encodeShareText output contains the score on the third line'`
- `'encodeShareText output contains the Vibratone puzzle URL on the last line'`

**`src/lib/learning/analytics/report.spec.ts`**

- `'generateProgressReport returns coldTestAccuracy: null when fewer than 3 cold-test sessions exist'`
- `'generateProgressReport renders correct coldTestAccuracy when 3+ cold sessions exist'`
- `'generateProgressReport correctly filters cold-test events from warm-up events'`
- `'generateProgressReport returns responseTimeDeltaMs: null when fewer than 3 timed sessions exist'`
- `'generateProgressReport returns transferGap: null when no transfer-timbre events exist'`
- `'generateProgressReport calculates transferGap as trained-timbre accuracy minus transfer-timbre accuracy'`
- `'generateProgressReport returns retentionTrend: null when fewer than 5 sessions exist'`
- `'generateProgressReport uses injected masteredPitchCount as pitchCountLearned when no attempt data covers mastery'`
- `'generateProgressReport returns pitchCountLearned: 0 when masteredPitchCount is 0'`
- `'generateProgressReport returns retentionTrend: null when fsrsForecast is null'`
- `'generateProgressReport handles empty AttemptEvent log without throwing'`
- `'generateProgressReport is a pure function: identical input yields identical output'`

**`src/lib/learning/protocols/research-mode.spec.ts`**

- `'research mode sets all five protocol properties to strict values on activation'`
- `'research mode restores default protocol properties on deactivation'`
- `'createResearchModeState initializes to false when no localStorage value is present'`
- `'createResearchModeState reads the persisted value from localStorage on construction'`

**`src/lib/learning/protocols/ap-program.spec.ts`**

- `'weekNumber is 1 on the day of enrollment'`
- `'weekNumber is 2 after 7 days have elapsed'`
- `'weekNumber is clamped at 8 when 60+ days have elapsed'`
- `'eight-week opt-out clears programStartDate but preserves FSRS state'`
- `'enroll() stores programStartDate and weeklySessionTarget in localStorage'`
- `'APProgramState round-trips through the persistence layer without data loss'`

### Component Tests (vitest-browser-svelte)

**`src/lib/components/share-card.svelte.test.ts`**

- `'share-card renders role="img" with aria-label containing the score summary'`
- `'share-card emoji grid is present in the visible content'`
- `'share-card visually hidden table has one row per puzzle prompt'`
- `'share-card each row in the accessible table is labeled correct or incorrect'`

**`src/lib/components/research-mode-toggle.svelte.test.ts`**

- `'research-mode-toggle checkbox is keyboard focusable and operable with Space'`
- `'research-mode-toggle checking the toggle updates bound state'`
- `'research-mode-toggle visible indicator text is present when researchMode is true'`
- `'research-mode-toggle visible indicator text is absent when researchMode is false'`

### Playwright End-to-End Tests

**`e2e/ap-beta-landing.spec.ts`**

- `'root route has AP entry CTA and honest-caveat statement visible without scrolling at 1280x800'`
- `'root route has AP entry CTA and honest-caveat statement visible without scrolling at 375x667'`
- `'root route has AP entry CTA and honest-caveat statement visible without scrolling at 768x1024'`
- `'claims/evidence link is keyboard reachable and navigates to /claims'`
- `'opt-in program dialog traps focus and closes on Escape'`

**`e2e/claims-page.spec.ts`**

- `'claims page contains Wong et al. citation, 7.08-pitches result, ~21-hours commitment, and no guarantee language'`
- `'claims page renders all citation text without dynamic JS (prerendered)'`
- `'claims page is navigable by keyboard with no keyboard trap'`

**`e2e/daily-puzzle.spec.ts`**

- `'daily puzzle is playable by a visitor who has not completed placement'`
- `'navigating to /puzzle renders the same first prompt on two separate loads (seeded reproducibility)'`
- `'share flow completes without navigating to a sign-up route'`
- `'share button triggers navigator.share or falls back to clipboard (mocked)'`
- `'share outcome is announced via aria-live region'`
- `'share card has role="img" with non-empty aria-label'`
- `'DailyPuzzleResult is written to localStorage under vibratone:daily-puzzle:v1 after completion'`
- `'share payload in localStorage does not contain rawAttemptEvent fields beyond the DailyPuzzleSharePayload contract'`
- `'daily puzzle is completable using keyboard-only navigation with accessible labels on each prompt'`
- `'full puzzle and report flow works with non-asset network requests blocked'`
- `'navigating away and back restores completed state from localStorage'`
- `'puzzle completes without layout overflow at 375x667'`

**`e2e/research-mode.spec.ts`**

- `'Research Mode badge is present in page header when research mode is enabled'`
- `'Research Mode badge is absent when research mode is disabled'`
- `'research mode setting persists after page reload'`
- `'research mode toggle is keyboard operable'`

**`e2e/progress-report.spec.ts`**

- `'progress report renders without error when localStorage is empty'`
- `'progress report shows correct cold-test accuracy derived from seeded fixture data in localStorage'`
- `'progress report is renderable without a network connection'`
- `'progress report does not contain a sign-in or create-account prompt'`
- `'progress report renders at phone width without layout overflow at 375x667'`
- `'progress report five metric dimensions are present in the DOM at 1280x800'`

**`e2e/opt-in-flow.spec.ts`**

- `'eight-week opt-in makes zero outbound network requests'`
- `'opt-in stores programStartDate in localStorage under vibratone:ap-program:v1'`
- `'after opt-in and reload, UI reflects program week 1'`
- `'opt-out clears programStartDate and returns to landing state'`
- `'opt-in control has an explicit accessible label and is reachable by Tab'`
- `'no account creation prompt appears at any point in the opt-in flow'`

### Acceptance Criterion Coverage Map

| AC                                                                                         | Tests that verify it                                                                           |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| AC-1: Root route has AP CTA and honest-caveat visible without scrolling                    | `e2e/ap-beta-landing.spec.ts` — three viewport specs                                           |
| AC-2: Claims page has citation, 7.08-pitches result, ~21 hours, no guarantee language      | `e2e/claims-page.spec.ts` — citation/content spec                                              |
| AC-3: Same date seed produces identical prompt sequences                                   | `puzzle-state.spec.ts` — `'daily puzzle generates identical prompt sequence…'`                 |
| AC-4: Puzzle and share flow complete without account prompt; offline flow works            | `e2e/daily-puzzle.spec.ts` — no-sign-up spec; offline/blocked-network spec                     |
| AC-5: Share payload contains exactly five allowlisted fields                               | `share.spec.ts` — `'share payload contains only allowlisted fields'`                           |
| AC-6: Research mode sets all five protocol properties; deactivation restores defaults      | `research-mode.spec.ts` — activation and deactivation specs                                    |
| AC-7: Research Mode badge present/absent based on toggle state                             | `e2e/research-mode.spec.ts` — badge present and absent specs                                   |
| AC-8: Opt-in stores programStartDate; zero outbound network requests during opt-in         | `e2e/opt-in-flow.spec.ts` — zero-requests spec; localStorage spec                              |
| AC-9: Opt-out clears programStartDate but preserves FSRS state                             | `ap-program.spec.ts` — `'eight-week opt-out clears programStartDate but preserves FSRS state'` |
| AC-10: Progress report shows placeholders for insufficient data; metrics when data present | `report.spec.ts` — null and non-null specs for each dimension                                  |
| AC-11: Daily puzzle is keyboard operable with accessible labels                            | `e2e/daily-puzzle.spec.ts` — keyboard-navigation spec                                          |

## Verification

Run the global quality gates:

```sh
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

Run the honest-claims grep gate (must return no matches):

```sh
grep -rE "perfect pitch|guaranteed|will learn" src/
```

Manual responsive smoke at 375px (phone), 768px (tablet), and 1280px (desktop) for:

- `/` (AP landing)
- `/puzzle` (daily puzzle)
- `/progress` (individual report)
- `/claims` (evidence page)

Manual offline check: disable network in DevTools, navigate to `/puzzle`, complete the puzzle, navigate to `/progress`, generate the report—all steps must complete without a network error.

## Non-Goals

- Do not introduce mandatory accounts.
- Do not introduce a database.
- Do not ship paid plans.
- Do not publish aggregate efficacy claims; that moves to the anonymous-aggregate milestone after the database line.
- Do not add leaderboards.
- Do not make AP acquisition guarantees.
- Do not gate the daily puzzle behind placement or eight-week program enrollment. The puzzle must be playable cold by any first-time visitor.
- Do not add native iOS, Android, or watch surfaces.
- Do not build the relative-pitch, theory, or production track surfaces in this milestone.

## Completion Signal

This milestone is complete when:

- The root route serves the AP beta landing page with honest claims visible without scrolling at all three tested widths.
- A first-time visitor can navigate to `/puzzle`, complete all 12 prompts, share the result, and generate a progress report—entirely from `localStorage`, with no account prompt and no network dependency beyond initial asset loading.
- All Playwright specs, unit tests, and component tests pass.
- The honest-claims grep gate returns no matches.
- `bun run check` and `bun run lint` are clean.
