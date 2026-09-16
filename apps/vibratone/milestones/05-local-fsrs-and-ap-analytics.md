# 05. Local FSRS and AP Analytics

## Outcome

Turn AP practice from random repetition into local-first memory scheduling with meaningful learner analytics. After this milestone, every AP answer feeds a per-card FSRS schedule, the Today surface shows what is due and why, and the analytics dashboard exposes weakness patterns at the pitch-class, timbre, and octave levels—all without an account or a database.

## Product Requirements

- Install **`ts-fsrs`** (`bun add ts-fsrs`, current stable `^5.0.0`) as the FSRS implementation. No other FSRS library is evaluated; the choice is made.
- Model AP cards at minimum as pitch class × timbre. Card identity: `${pitchClass}:${timbre}` (e.g. `"4:piano"`).
- Store octave and register in attempt records as dimensions for analytics even before register is scored as a primary task.
- Implement FSRS review states: `new`, `learning`, `review`, and `relearning`.
- Generate a due-card queue from FSRS state (cards where `due <= now`, sorted by `due` ascending).
- Generate weak-card recommendations from due state plus confusion data (retrievability < 0.7 or top-3 confusion-pair target).
- Add a **Today surface** at `/today` (AP-only, two sections): (a) due AP cards from the FSRS queue; (b) daily cold-open entry point.
- Add a **daily cold open**: a timed, no-feedback, no-reference-pitch session of 7 prompts (default; defined as `COLD_OPEN_ITEM_COUNT = 7` in `cold-open.ts`). Trigger: once per calendar day, on first app load after midnight local time. Cold-open answers are measurement-only—they are written to a separate `ColdOpenAttempt` log and do **not** update any FSRS card state or schedule. The learner may dismiss the cold open; the skip is recorded as a `cold-open-skipped` event and does not count as a missed day for retention metrics. A dismissed cold open reappears the next calendar day.
- Add an **auditory-working-memory mini-assessment**: one-time (not daily), opt-in, presented before the learner's first AP training session. Protocol: 5 trials; each trial plays a sequence of 3 synthesized tones (600 ms per tone, 200 ms gap) and asks the learner to identify the last note via the piano keyboard answer surface. No microphone required. Score = number of correct last-note identifications out of 5. Output written to local state: `awm_score` (0–5), `awm_bucket` (`low` / `medium` / `high` using thresholds 0–1 / 2–3 / 4–5), `awm_completed_at` (Unix ms). A **Skip** action is always visible and dismisses the assessment without writing any score. A skipped assessment surfaces a note on the Today surface ("Take the short memory check to calibrate your plan — optional") until permanently dismissed or completed. No training is blocked by any score.
- Add local export/import of progress. Export: a single JSON file downloaded in the browser, no network requests. Import: validates `schemaVersion`; rejects payloads with unknown or missing versions with a typed error message.
- Add an **AP analytics dashboard** at `/dashboard` with confusion matrix (accessible fallback table as primary implementation), weak-concept summaries, per-timbre accuracy breakdown, per-octave accuracy breakdown, and observed recall vs. FSRS forecast.

## User Experience Requirements

- The Today surface (`/today`) shows two clearly separated sections: **Due AP cards** (listed by pitch class and timbre) and **Cold open** (entry prompt or "Completed" state). It does not aggregate work from other tracks.
- The learner can understand why a card is due: each due-card entry shows its pitch class, timbre, and a plain-language due-reason (e.g. "Due today — last reviewed 3 days ago").
- The dashboard answers: which pitch classes are weak, what they are confused with, whether weakness is timbre-dependent, and whether it is octave-dependent.
- Export/import is presented as local control, not account sync. The export trigger label is "Export progress" and the import control label is "Import progress".
- The mini-assessment results screen displays a plain-language readout calibrating expectations—for example: "You recalled N of 5 sequences. Auditory working memory varies widely and does not determine whether you can learn absolute pitch, but learners with lower scores may benefit from shorter daily sessions." The copy must contain no guaranteed-AP language.
- A learner who has never completed the mini-assessment can reach an AP training session in at most 2 user actions from the Today surface.

## Data and Analytics Requirements

- Every AP training answer updates a `FSRSCard` record in local state with new due date, stability, difficulty, elapsed days, scheduled days, reps, lapses, and state values, AND appends an immutable `ReviewEvent` to the local review log.
- Cold-open answers are stored as `ColdOpenAttempt` records in a separate log (`vibratone:cold-open-log:v1`). Cold-open answers do **not** mutate any `FSRSCard` and do **not** append a `ReviewEvent` to the training review log.
- Store confusion matrix inputs as target pitch class and guessed pitch class, derived from the `AttemptEvent` log (not stored as a separate persisted structure). `buildConfusionMatrix` filters to training events only.
- Track observed recall vs. FSRS forecast per card. Divergence is a passive tracking metric in this milestone (no UI action required); surface the three cards with largest over- and under-prediction.
- Preserve import/export schema version. Initial version: `schemaVersion: 1`.

**`FSRSCard` type** (canonical definition in `src/lib/learning/scheduling/fsrs-card.ts`):

```ts
export type FSRSCardState = 'new' | 'learning' | 'review' | 'relearning';

export type FSRSCard = {
	cardId: string; // `${pitchClass}:${timbre}`
	pitchClass: PitchClass;
	timbre: string;
	due: number; // Unix ms
	stability: number;
	difficulty: number;
	elapsedDays: number;
	scheduledDays: number;
	reps: number;
	lapses: number;
	state: FSRSCardState;
	lastReview: number | null;
};
```

**`ReviewEvent` type** (canonical definition in `src/lib/learning/scheduling/fsrs-card.ts`):

```ts
export type ReviewEvent = {
	version: 1;
	cardId: string;
	sessionId: string; // SESSION_ID from attempt-log.ts
	timestamp: number;
	rating: 'again' | 'hard' | 'good' | 'easy';
	stateBefore: FSRSCardState;
	stateAfter: FSRSCardState;
	scheduledDays: number; // days until next due
};
```

**`ColdOpenAttempt` type** (canonical definition in `src/lib/learning/scheduling/cold-open.ts`):

```ts
export type ColdOpenAttempt = {
	version: 1;
	sessionDate: string; // YYYY-MM-DD, local calendar day
	timestamp: number;
	pitchClass: PitchClass;
	octave: number;
	timbre: string;
	answer: PitchClass;
	correct: boolean;
	responseTimeMs: number;
};
```

**`ProgressExport` envelope** (canonical definition in `src/lib/learning/scheduling/card-store.svelte.ts`):

```ts
export type ProgressExport = {
	schemaVersion: 1;
	exportedAt: number; // Date.now()
	cards: Record<string, FSRSCard>; // keyed by cardId
	reviewLog: ReviewEvent[];
	coldOpenLog: ColdOpenAttempt[];
	wmAssessment: WMAssessmentResult | null;
};
```

Export filename pattern: `vibratone-progress-YYYY-MM-DD.json`.

**FSRS rating mapping rule** (defined as constants in `src/lib/learning/protocols/ap-card-identity.ts`):

- `wasCorrect && responseTimeMs < AP_RESPONSE_THRESHOLD_MS` → `Rating.Good`
- `wasCorrect && responseTimeMs >= AP_RESPONSE_THRESHOLD_MS` → `Rating.Hard`
- `!wasCorrect` → `Rating.Again`
- `Rating.Easy` is reserved for an explicit "I already know this" user action — deferred to a later milestone, not implemented here.

`AP_RESPONSE_THRESHOLD_MS = 3000` (derived from the Wong et al. 2025 AP training protocol's tightening response window). This constant must be named so it can be adjusted without a grep.

**`WMAssessmentResult` type** (in `src/routes/assessment/working-memory/+page.svelte`):

```ts
export type WMAssessmentResult = {
	score: number; // 0–5
	maxScore: 5;
	label: 'low' | 'medium' | 'high'; // 0–1 low, 2–3 medium, 4–5 high
	completedAt: number;
};
```

**`localStorage` key register:**

| Key                           | Type                         | Notes                                              |
| ----------------------------- | ---------------------------- | -------------------------------------------------- |
| `vibratone:fsrs-cards:v1`     | `Record<string, FSRSCard>`   | Full FSRS state per card; replaced on each write   |
| `vibratone:review-log:v1`     | `ReviewEvent[]`              | Append-only; training events only                  |
| `vibratone:cold-open-log:v1`  | `ColdOpenAttempt[]`          | Append-only; cold-open sessions only               |
| `vibratone:cold-open-date:v1` | `string`                     | YYYY-MM-DD of last completed cold-open             |
| `vibratone:wm-assessment:v1`  | `WMAssessmentResult \| null` | Single result object, overwritten on re-assessment |

## Accessibility Requirements

- Dashboard charts must have adjacent text summaries derived from the same data (`$derived` in `+page.svelte`—not a separate accessibility audit pass).
- The confusion matrix accessible fallback table is the **primary implementation** until Cinder #319 ships. It must have: `<caption>`, `scope="row"` on row headers, and `scope="col"` on column headers. Screen-reader accessible names on each cell of the form "{target} mistaken for {guessed}: {count} times".
- Export/import controls must have visible focus rings, `aria-label` attributes, and import errors rendered in a `role="alert"` region.
- The cold-open drill must be completable without a mouse: Tab navigates to play/replay, keyboard submits the answer via the piano keyboard component (already verified keyboard-operable in milestone 00).
- The mini-assessment results screen must display result text at any score so blind and low-vision users receive the full expectation-setting message.
- Today surface and dashboard must pass responsive smoke at 375 × 667, 768 × 1024, and 1 280 × 800.

## Module and Architecture Targets

| File                                                  | Action     | What lands there                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/learning/scheduling/fsrs-card.ts`            | **Create** | `FSRSCard`, `FSRSCardState`, `ReviewEvent` types; `processGuess(card, rating, now): { card: FSRSCard; event: ReviewEvent }` wrapper around `ts-fsrs`; `createNewCard(cardId, pitchClass, timbre): FSRSCard`                                                                                                                                            |
| `src/lib/learning/scheduling/due-queue.ts`            | **Create** | Pure `buildDueQueue(cards: FSRSCard[], now: number): FSRSCard[]` — filters `due <= now`, sorts ascending; `buildNewCardQueue(cards: FSRSCard[], limit: number): FSRSCard[]`                                                                                                                                                                            |
| `src/lib/learning/scheduling/cold-open.ts`            | **Create** | `ColdOpenAttempt` type; `COLD_OPEN_ITEM_COUNT = 7`; `isColdOpenDue(lastDate: string \| null, now: Date): boolean`; `ColdOpenSession` type; `buildColdOpenPrompts(config: DrillConfig, count: number): DrillPrompt[]`                                                                                                                                   |
| `src/lib/learning/scheduling/review-log.ts`           | **Create** | `appendReviewEvent(event: ReviewEvent): void`; `loadReviewLog(): ReviewEvent[]` backed by `localStorageOrNull()`; `appendColdOpenAttempt(attempt: ColdOpenAttempt): void`; `loadColdOpenLog(): ColdOpenAttempt[]`                                                                                                                                      |
| `src/lib/learning/scheduling/card-store.svelte.ts`    | **Create** | `createCardStore()` factory; `[getCardStore, setCardStore]` context pair via `createContext<CardStore>()`; `$state`-backed `SvelteMap<string, FSRSCard>`; `processGuess`, `load`, `save`, `exportAll`, `importAll` actions. All `localStorage` access guarded through `localStorageOrNull()`.                                                          |
| `src/lib/learning/scheduling/index.ts`                | **Create** | Barrel re-export of scheduling public surface                                                                                                                                                                                                                                                                                                          |
| `src/lib/learning/analytics/confusion-matrix.ts`      | **Create** | `buildConfusionMatrix(events: AttemptEvent[]): number[][]` — 12×12 zero-initialized matrix; row = target pitch class index, column = guessed pitch class index; filters to events where `stimulusType !== 'cold-open'`; `weakPitchClasses(matrix: number[][]): PitchClass[]`; `confusionPairsFor(pc: PitchClass, matrix: number[][]): ConfusionPair[]` |
| `src/lib/learning/analytics/mastery-summary.ts`       | **Create** | `buildWeakCardRecommendations(cards: FSRSCard[], matrix: number[][]): WeakCardRecommendation[]`; `WeakCardRecommendation` type with `card`, `reason: 'low-retrievability' \| 'confusion-pair' \| 'both'`, `confusedWith: PitchClass[]`, `retrievability: number` (0–1)                                                                                 |
| `src/lib/learning/analytics/recall-calibration.ts`    | **Create** | `computeCalibration(card: FSRSCard, events: ReviewEvent[]): CalibrationResult \| null` — returns `null` when fewer than 5 review events exist; `CalibrationResult` type with `divergence: number`, `flag: 'over-stable' \| 'under-stable' \| 'calibrated'`                                                                                             |
| `src/lib/learning/analytics/index.ts`                 | **Create** | Barrel re-export of analytics public surface                                                                                                                                                                                                                                                                                                           |
| `src/lib/learning/protocols/ap-card-identity.ts`      | **Create** | `apCardId(pitchClass: PitchClass, timbre: string): string` returns `` `${pitchClass}:${timbre}` ``; `AP_RESPONSE_THRESHOLD_MS = 3000`; `ratingFromAttempt(wasCorrect: boolean, responseTimeMs: number): Rating`                                                                                                                                        |
| `src/lib/learning/protocols/index.ts`                 | **Create** | Barrel re-export                                                                                                                                                                                                                                                                                                                                       |
| `src/lib/persistence.ts`                              | **Modify** | Add storage key constants: `FSRS_CARDS_KEY`, `REVIEW_LOG_KEY`, `COLD_OPEN_LOG_KEY`, `COLD_OPEN_DATE_KEY`, `WM_ASSESSMENT_KEY`; add `isReviewEvent`, `isColdOpenAttempt`, `isFSRSCard` type guards                                                                                                                                                      |
| `src/lib/state.svelte.ts`                             | **Modify** | `guess()` calls `getCardStore().processGuess(cardId, rating)` synchronously after `appendAttemptEvent`; `cardId` derived via `apCardId`; rating via `ratingFromAttempt`; no change to existing public API surface                                                                                                                                      |
| `src/lib/components/confusion-matrix-fallback.svelte` | **Create** | Accessible `<table>` with `<caption>`, `scope="row"` row headers, `scope="col"` column headers; used as both primary implementation and accessibility fallback                                                                                                                                                                                         |
| `src/lib/components/due-card-badge.svelte`            | **Create** | Badge showing due-card count; used in app header and Today surface                                                                                                                                                                                                                                                                                     |
| `src/lib/components/export-import-panel.svelte`       | **Create** | Download trigger and `<input type="file">` import; errors in `role="alert"` region; all file-API calls inside event handlers                                                                                                                                                                                                                           |
| `src/routes/today/+page.ts`                           | **Create** | Universal load function; `export const ssr = false`; returns empty object (all data is client-local, SSR would produce a hydration mismatch since `localStorageOrNull()` returns `null` on the server)                                                                                                                                                 |
| `src/routes/today/+page.svelte`                       | **Create** | Today surface: cold-open section, due-drill queue, navigation to training; instantiates card store via `setCardStore(createCardStore())`                                                                                                                                                                                                               |
| `src/routes/dashboard/+page.ts`                       | **Create** | Universal load function; `export const ssr = false`                                                                                                                                                                                                                                                                                                    |
| `src/routes/dashboard/+page.svelte`                   | **Create** | Analytics dashboard: weak-card list, confusion matrix (fallback table), timbre breakdown, octave breakdown, FSRS forecast vs. observed recall; all data derived on mount from localStorage                                                                                                                                                             |
| `src/routes/assessment/working-memory/+page.ts`       | **Create** | Universal load function; `export const ssr = false`                                                                                                                                                                                                                                                                                                    |
| `src/routes/assessment/working-memory/+page.svelte`   | **Create** | Auditory working memory mini-assessment UI; 5 trials × 3-note sequences; identify last note via piano keyboard; stores result under `WM_ASSESSMENT_KEY`                                                                                                                                                                                                |

**SSR safety invariant (reaffirmed):** Every file under `src/lib/learning/scheduling/`, `src/lib/learning/analytics/`, and `src/lib/learning/protocols/` must contain no reference to `window`, `document`, `localStorage`, `navigator`, or `requestAnimationFrame` at module initialization time. Both new routes use `export const ssr = false` because all data is `localStorage`-derived and SSR would render empty shells that mismatch client hydration. This is an explicit opt-out, not an oversight.

**No `$effect` for persistence:** Every `saveJSON` call fires synchronously inside an action function (`processGuess`, `importAll`), never from an ambient `$effect`. This prevents hydration-time overwrites and makes every save traceable.

**No autoplay on mount:** The cold-open card renders a "Begin cold check" button. Audio construction calls `getSynth()` synchronously inside the `onclick` handler, preserving the browser gesture association. No `onMount` audio, no `$effect` audio.

**Timer invariant:** Any timers introduced in this milestone (e.g. cold-open prompt countdown) are plain `let` variables, not `$state`. Cleanup fires from `onDestroy`.

**Cross-route data flow:** FSRS state does not live in a layout-level shared context. Each route reads cards and the review log from `localStorage` on mount. Live cross-route reactivity (e.g. a due-count badge in the header) may use `BroadcastChannel` in a later milestone.

**`AttemptEvent` stays at version 1.** Cold-open sessions are tracked via the new `ColdOpenAttempt` type in its own log key, leaving `AttemptEvent` unchanged. This avoids the migration helper complexity that a v2 bump would require.

**Card store context pattern:**

```ts
// card-store.svelte.ts
import { createContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

export type CardStore = ReturnType<typeof createCardStore>;
const [getCardStore, setCardStore] = createContext<CardStore>();
export { getCardStore, setCardStore };

export function createCardStore() {
  // All localStorage access guarded via localStorageOrNull()
  const cards = new SvelteMap<string, FSRSCard>(...);
  function processGuess(cardId: string, rating: Rating, now = Date.now()): ReviewEvent { ... }
  function save(): void { ... }
  function exportAll(): ProgressExport { ... }
  function importAll(data: ProgressExport): void { ... }
  return { cards, processGuess, save, exportAll, importAll };
}
```

`setCardStore` is called in the same provider (`/today/+page.svelte`) and wired into the existing practice route. No module-level `$state`.

## Dependencies

- **Milestone 04 (AP Trainer MVP)**: directly required. The sampled timbres introduced in milestone 04 supply valid `timbre` values for FSRS card IDs (`${pitchClass}:${timbre}`). The no-feedback placement prompt infrastructure from milestone 04 is reused for cold-open prompts—no new prompt engine is required. The `DrillConfig`, `DrillPrompt`, and `AttemptEvent` types from milestone 00 (consumed transitively through 04) are the scheduling input.

All prior milestones (00 through 04) are transitively required because FSRS card exercise depends on a working AP training loop with sampled audio.

## External Dependency Contracts

| Capability                               | Owner                                                                         | Contract needed                                                                                                                                      | Stub/mock plan                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FSRS-5 algorithm                         | `ts-fsrs` npm package (`bun add ts-fsrs`, pin `^5.0.0`; current stable 5.4.1) | `import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs'`; `fsrs(params).repeat(card, now)` returns `Record<Rating, RecordLog>` | `src/lib/learning/scheduling/__stubs__/fsrs-stub.ts` — fixed-interval deterministic algorithm (Again → 1 day, Hard → 3 days, Good → 7 days, Easy → 21 days) with the same function signatures; used in unit tests so tests never depend on algorithm internals |
| Retrievability formula                   | `ts-fsrs` internal                                                            | `Math.exp(-elapsedDays / stability)` — the same formula `ts-fsrs` uses internally                                                                    | Use this formula directly in `recall-calibration.ts`; no additional stub needed                                                                                                                                                                                |
| Confusion matrix / heatmap visualization | Cinder [#319](https://github.com/stevekinney/cinder/issues/319)               | `<ConfusionMatrix data={number[][]} rowLabels={string[]} colLabels={string[]} aria-label={string} />`                                                | `src/lib/components/confusion-matrix-fallback.svelte` — semantic `<table>` with `<caption>`, `scope="row"`, `scope="col"`; ships immediately as primary implementation and satisfies the accessibility requirement independently of #319                       |

## Acceptance Criteria

Each criterion is a concrete pass/fail check with named verifying tests.

**AC-1 — FSRS updates on every training answer:**
After every AP training prompt answer (correct or incorrect), the corresponding `FSRSCard` record is updated in local state with the new due date, stability, difficulty, elapsed days, scheduled days, reps, lapses, and state, AND an immutable `ReviewEvent` is appended to `vibratone:review-log:v1`. A unit test named `fsrs-card: processGuess on a new card with Rating.Good transitions state to learning and appends a ReviewEvent` and `fsrs-card: processGuess with Rating.Again increments lapses and transitions a review card to relearning` verify the correct FSRS state transitions using `ts-fsrs`'s own output as the reference.

**AC-2 — Today surface renders two distinct sections:**
Loading `/today` after at least one FSRS card exists shows (a) a "Due today" section listing cards by pitch class and timbre, and (b) a "Cold open" section showing either an entry prompt (if the cold open has not been completed today) or a "Completed" state (if it has). The two sections are visually and semantically separate (distinct headings). A Playwright test named `today-surface [1280×800]: cold-open section is distinct from the training queue` asserts both regions exist and that cold-open completion status updates without a page reload.

**AC-3 — Export fires no network requests; import validates schema version:**
Triggering export downloads a single JSON file and the Playwright test `import-export [1280×800]: export button triggers a JSON file download with schemaVersion 1` asserts no network requests were made during the export action (using `page.route()` interception). Triggering import with a JSON payload whose `schemaVersion` field is missing or set to an unknown value shows a specific error message (e.g. "This file was exported from an incompatible version of Vibratone") in a `role="alert"` region and does not modify any existing local FSRS state. Unit tests `import-export: importAll with unknown schemaVersion throws ImportError` and `import-export: importAll followed by exportAll deepEquals the original export` verify both paths.

**AC-4 — Dashboard displays four named analytics regions:**
The analytics dashboard renders: (a) a ranked list of the bottom 3 pitch classes by recall accuracy, (b) the top 3 confusion pairs (target → most-guessed pitch class), (c) a per-timbre accuracy breakdown, and (d) a per-octave accuracy breakdown. Each region has a text-summary fallback. A Playwright test named `dashboard [1280×800]: all four analytics regions are present when seeded with fixture data` asserts all four regions exist when seeded with fixture data.

**AC-5 — Training is always reachable; mini-assessment is skippable:**
A learner who has never completed the mini-assessment can reach an AP training session in at most 2 user actions from the Today surface. The Skip action on the assessment screen dismisses it without writing `awm_score` or `awm_bucket` to local state. Playwright tests `cold-open [1280×800]: learner can dismiss the working-memory assessment and enter training immediately` and `cold-open [1280×800]: completed assessment score is stored and displayed without blocking training` cover both paths.

**AC-6 — Cold-open attempts are isolated from training metrics and do not mutate FSRS state:**
Cold-open answers write a `ColdOpenAttempt` record to `vibratone:cold-open-log:v1` and do **not** write to `vibratone:review-log:v1` and do **not** update any `FSRSCard`. The `buildConfusionMatrix` function and all due-queue calculations use only `AttemptEvent` records (from `vibratone:attempts:v1`). Unit tests `cold-open: cold-open attempt does not mutate FSRSCard state`, `review-log: ColdOpenAttempt is written to cold-open-log key only`, and `confusion-matrix: buildConfusionMatrix uses only AttemptEvent records, not ColdOpenAttempt` verify the isolation at the data layer.

**AC-7 — Observed recall vs. FSRS forecast is surfaced:**
The dashboard displays an observed-recall-versus-FSRS-forecast comparison for each pitch-class card. It includes a text summary listing the three cards with the largest positive forecast error (FSRS predicted retention but learner missed) and the three with the largest negative forecast error (FSRS underestimated recall). A unit test named `recall-calibration: computeCalibration produces correct divergence deltas given a seeded review log` verifies the aggregation logic.

**AC-8 — No overclaiming copy on new surfaces:**
The mini-assessment results screen and the analytics dashboard contain no language that promises or implies guaranteed AP acquisition. Any performance summary referencing outcomes includes a visible caveat referencing study variance (e.g. citing the Wong 2025 average of 7.08 pitches at 90%+ accuracy). A manual review checklist item covers both surfaces before milestone sign-off, and the grep gate `grep -rE "perfect pitch|guaranteed|will learn" src/` returns no matches.

## Test Plan

### Unit tests — `src/lib/learning/scheduling/`

**`fsrs-card.spec.ts`**

- `fsrs-card: createNewCard returns state 'new' with reps 0 and lapses 0`
- `fsrs-card: processGuess on a new card with Rating.Good transitions state to learning`
- `fsrs-card: processGuess on a new card with Rating.Good returns a ReviewEvent with stateBefore 'new' and stateAfter 'learning'`
- `fsrs-card: processGuess on a learning card with Rating.Good transitions state to review with positive scheduledDays`
- `fsrs-card: processGuess on a review card with Rating.Again increments lapses and transitions state to relearning`
- `fsrs-card: processGuess with Rating.Again on a new card does not increment lapses`
- `fsrs-card: ReviewEvent version is the literal 1`
- `fsrs-card: ReviewEvent contains cardId, sessionId, timestamp, rating, stateBefore, stateAfter, scheduledDays`
- `fsrs-card: scheduledDays is positive after any non-Again rating`

**`due-queue.spec.ts`**

- `due-queue: buildDueQueue returns cards with due <= now sorted by due ascending`
- `due-queue: buildDueQueue excludes cards with due > now`
- `due-queue: buildDueQueue returns empty array when all cards are future-dated`
- `due-queue: buildDueQueue returns empty array when card map is empty`
- `due-queue: new-state cards appear in buildNewCardQueue, not in buildDueQueue`

**`cold-open.spec.ts`**

- `cold-open: isColdOpenDue returns true when lastDate is null`
- `cold-open: isColdOpenDue returns true when lastDate is before midnight of the current local day`
- `cold-open: isColdOpenDue returns false when lastDate is the current local day's YYYY-MM-DD string`
- `cold-open: buildColdOpenPrompts returns exactly COLD_OPEN_ITEM_COUNT prompts with no feedback`
- `cold-open: cold-open attempt does not mutate FSRSCard state`

**`review-log.spec.ts`**

- `review-log: appendReviewEvent appends to vibratone:review-log:v1 and does not touch cold-open-log`
- `review-log: appendColdOpenAttempt appends to vibratone:cold-open-log:v1 and does not touch review-log`
- `review-log: loadReviewLog returns empty array when key is absent`
- `review-log: loadColdOpenLog returns empty array when key is absent`
- `review-log: ColdOpenAttempt records are absent from loadReviewLog results`

**`import-export.spec.ts`**

- `import-export: exportAll returns a ProgressExport with schemaVersion 1`
- `import-export: exportAll includes all current cards and review log`
- `import-export: importAll followed by exportAll deepEquals the original export`
- `import-export: importAll with unknown schemaVersion throws ImportError`
- `import-export: importAll with missing schemaVersion throws ImportError`
- `import-export: importAll with malformed JSON rejects with ImportError without throwing`
- `import-export: exported JSON contains exportedAt timestamp within 1000ms of call time`

### Unit tests — `src/lib/learning/analytics/`

**`confusion-matrix.spec.ts`**

- `confusion-matrix: buildConfusionMatrix returns a 12×12 zero matrix when no events are provided`
- `confusion-matrix: buildConfusionMatrix increments matrix[targetIndex][guessedIndex] for each incorrect attempt`
- `confusion-matrix: buildConfusionMatrix increments diagonal cell for correct attempts`
- `confusion-matrix: buildConfusionMatrix uses only AttemptEvent records, not ColdOpenAttempt`
- `confusion-matrix: weakPitchClasses returns pitch classes sorted by off-diagonal error rate descending`
- `confusion-matrix: weakPitchClasses excludes pitch classes with zero total attempts`
- `confusion-matrix: confusionPairsFor returns empty array when pitch class has no confusion data`
- `confusion-matrix: confusionPairsFor does not include self-pairs (diagonal)`

**`mastery-summary.spec.ts`**

- `mastery-summary: returns empty array when no cards exist`
- `mastery-summary: card with retrievability < 0.7 is included with reason low-retrievability`
- `mastery-summary: card appearing in top-3 confusion targets is included with reason confusion-pair`
- `mastery-summary: card meeting both criteria has reason both`
- `mastery-summary: results are sorted by retrievability ascending`

**`recall-calibration.spec.ts`**

- `recall-calibration: returns null when fewer than 5 review events exist for a card`
- `recall-calibration: when observed recall equals FSRS forecast, divergence is 0`
- `recall-calibration: when observed recall exceeds forecast by more than 20%, flag is over-stable`
- `recall-calibration: when observed recall is below forecast by more than 20%, flag is under-stable`
- `recall-calibration: computeCalibration produces correct divergence deltas given a seeded review log`

### Unit tests — `src/lib/learning/protocols/`

**`ap-card-identity.spec.ts`**

- `ap-card-identity: apCardId returns pitchClass:timbre string`
- `ap-card-identity: ratingFromAttempt returns Again for incorrect guess regardless of response time`
- `ap-card-identity: ratingFromAttempt returns Good for correct guess under AP_RESPONSE_THRESHOLD_MS`
- `ap-card-identity: ratingFromAttempt returns Hard for correct guess at or above AP_RESPONSE_THRESHOLD_MS`
- `ap-card-identity: AP_RESPONSE_THRESHOLD_MS equals 3000`

### Regression tests (must remain green, not modified)

- All `src/lib/learning/drills/*.spec.ts` tests from milestone 00
- All `src/lib/*.spec.ts` tests (round, scoring, music, persistence, audio)
- All `*.svelte.test.ts` component tests from milestones 00–04

### Component tests (vitest-browser-svelte)

**`src/lib/components/confusion-matrix-fallback.svelte.test.ts`**

- `confusion-matrix-fallback: renders a <table> element with <caption>`
- `confusion-matrix-fallback: each row header has scope="row"`
- `confusion-matrix-fallback: each column header has scope="col"`
- `confusion-matrix-fallback: non-zero cells render their numeric value`
- `confusion-matrix-fallback: zero cells render as 0 (consistent choice)`
- `confusion-matrix-fallback: keyboard — Tab reaches every non-zero cell in the table`

**`src/lib/components/export-import-panel.svelte.test.ts`**

- `export-import-panel: export button has accessible label "Export progress"`
- `export-import-panel: import file input has accessible label "Import progress" and accepts only .json`
- `export-import-panel: malformed import renders error text in role="alert" region`
- `export-import-panel: successful import clears the error region`
- `export-import-panel: export and import controls are keyboard-reachable`

### Playwright E2E tests (`e2e/`)

**`e2e/today-surface.spec.ts`**

- `today-surface [1280×800]: due cards section is present and lists at least zero cards`
- `today-surface [1280×800]: cold-open section is distinct from the training queue`
- `today-surface [1280×800]: cold-open completion status updates without a page reload`
- `today-surface [375×667]: layout completes without horizontal overflow`
- `today-surface [768×1024]: layout is usable and interactive elements are reachable`
- `today-surface [1280×800]: keyboard — Tab reaches every interactive element in the due queue`

**`e2e/cold-open.spec.ts`**

- `cold-open [1280×800]: learner can dismiss the working-memory assessment and enter training immediately`
- `cold-open [1280×800]: completed assessment score is stored and displayed without blocking training`
- `cold-open [1280×800]: assessment prompts have no visual answer feedback between prompts`
- `cold-open [1280×800]: keyboard-only — Tab and Enter complete the entire cold-open flow without a mouse`

**`e2e/dashboard.spec.ts`**

- `dashboard [1280×800]: confusion matrix fallback table is present in the DOM with row and column headers for all 12 pitch classes`
- `dashboard [1280×800]: weak-card list renders (empty state acceptable when no cards exist)`
- `dashboard [1280×800]: timbre breakdown section is present`
- `dashboard [1280×800]: all four analytics regions are present when seeded with fixture data`
- `dashboard [1280×800]: page is fully keyboard navigable without mouse`
- `dashboard [375×667]: dashboard renders without overflow at phone width`
- `dashboard [768×1024]: confusion matrix or fallback table is reachable`

**`e2e/import-export.spec.ts`**

- `import-export [1280×800]: export button triggers a JSON file download with schemaVersion 1`
- `import-export [1280×800]: export action fires no network requests (page.route interception)`
- `import-export [1280×800]: importing a previously exported file restores card state visible in the dashboard`
- `import-export [1280×800]: importing a file with an unknown schemaVersion shows an error message in role="alert" without crashing`
- `import-export [1280×800]: importing a corrupted JSON file shows an accessible error message`
- `import-export [1280×800]: after a failed import, the user's existing progress is unchanged`
- `import-export [1280×800]: import control has a visible focus ring and accessible label`

**`e2e/fsrs-integration.spec.ts`**

- `fsrs-integration [1280×800]: completing a 5-drill training session updates localStorage vibratone:fsrs-cards:v1`
- `fsrs-integration [1280×800]: after a session, vibratone:review-log:v1 contains the same number of ReviewEvents as answered drills`
- `fsrs-integration [1280×800]: after a correct guess, the card's reps count in localStorage increments by 1`
- `fsrs-integration [1280×800]: answering incorrectly does not append to vibratone:review-log:v1 cold-open-log`

### Acceptance-criteria-to-test map

| Acceptance Criterion | Covered by |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| AC-1 — FSRS updates on every training answer | `fsrs-card.spec.ts: processGuess*`, `e2e/fsrs-integration.spec.ts` |
| AC-2 — Today surface renders two distinct sections | `today-surface [1280×800]: cold-open section is distinct…`, `today-surface [1280×800]: cold-open completion status updates…` |
| AC-3 — Export fires no network requests; import validates schema version | `import-export.spec.ts: importAll with unknown schemaVersion throws ImportError`, `e2e/import-export.spec.ts: export action fires no network requests`, `e2e/import-export.spec.ts: importing a file with an unknown schemaVersion shows an error message` |
| AC-4 — Dashboard displays four named analytics regions | `e2e/dashboard.spec.ts: all four analytics regions are present when seeded with fixture data` |
| AC-5 — Training is always reachable; mini-assessment is skippable | `e2e/cold-open.spec.ts: learner can dismiss…` and `e2e/cold-open.spec.ts: completed assessment score is stored… without blocking training` |
| AC-6 — Cold-open attempts are isolated and do not mutate FSRS state | `cold-open.spec.ts: cold-open attempt does not mutate FSRSCard state`, `review-log.spec.ts: ColdOpenAttempt records are absent from loadReviewLog results`, `confusion-matrix.spec.ts: buildConfusionMatrix uses only AttemptEvent records` |
| AC-7 — Observed recall vs. FSRS forecast is surfaced | `recall-calibration.spec.ts: computeCalibration produces correct divergence deltas given a seeded review log`, `e2e/dashboard.spec.ts: all four analytics regions are present` |
| AC-8 — No overclaiming copy on new surfaces | `grep -rE "perfect pitch                                                                                                                                                                                                                                   | guaranteed | will learn" src/` gate; manual review checklist |

## Verification

Run these gate commands in order. All must exit clean before the milestone is declared complete:

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

**Grep gate (AP-claims guard):**

```
grep -rE "perfect pitch|guaranteed|will learn" src/
```

This must return no matches.

**SSR safety gate:**

```
grep -rE "window\.|document\.|localStorage|navigator\." src/lib/learning/
```

No matches outside of functions guarded by `localStorageOrNull()`.

**Manual browser smokes:**

- Chrome at 1280×800: complete a 5-drill AP training session; open DevTools → Application → Local Storage; confirm `vibratone:fsrs-cards:v1` is populated with cards showing non-zero `reps` and future `due` timestamps; confirm `vibratone:review-log:v1` has the same number of entries as drills answered.
- Chrome at 375×667: Today surface and dashboard render without horizontal overflow.
- Safari: same smoke as Chrome.
- Manual review of mini-assessment results screen and dashboard for overclaiming language (AC-8 checklist item).

## Non-Goals

- Do not optimize FSRS parameters per learner. Global default parameters from `generatorParameters()` are used throughout this milestone.
- Do not add a database. All data is `localStorage`-only.
- Do not add cloud sync.
- Do not add teacher exports.
- Do not add AI recommendations.
- Do not build a cross-track Today surface. The Today surface introduced here is AP-only; cross-track scheduling and the unified Today surface are the scope of milestone 19.
- Do not add `Rating.Easy` as a learner-facing action; it is reserved for a future "I already know this" user gesture.
- Do not bump `AttemptEvent` to version 2 in this milestone. Cold-open sessions use a separate `ColdOpenAttempt` type and log key.
- Do not implement register scoring as a primary task dimension.

## Completion Signal

Milestone 05 is complete when:

1. `bun run check`, `bun run lint`, and `bun run test:unit -- --run` all exit clean with zero new failures.
2. All named unit tests in `src/lib/learning/scheduling/`, `src/lib/learning/analytics/`, and `src/lib/learning/protocols/` pass.
3. All pre-existing `*.spec.ts` and `*.svelte.test.ts` tests remain green (zero regressions).
4. All named Playwright specs in `e2e/today-surface.spec.ts`, `e2e/cold-open.spec.ts`, `e2e/dashboard.spec.ts`, `e2e/import-export.spec.ts`, and `e2e/fsrs-integration.spec.ts` pass at all declared viewports.
5. `vibratone:fsrs-cards:v1`, `vibratone:review-log:v1`, and `vibratone:cold-open-log:v1` are populated in `localStorage` after a manual browser session.
6. The grep AP-claims gate returns no matches.
7. The SSR safety gate returns no matches outside guarded functions.
8. The mini-assessment results screen and dashboard pass the manual AC-8 overclaiming review checklist.
9. `src/lib/learning/scheduling/index.ts` and `src/lib/learning/analytics/index.ts` export their respective public surfaces as the shared contract for milestone 06 and beyond.
