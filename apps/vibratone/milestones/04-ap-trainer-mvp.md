# 04. AP Trainer MVP

## Outcome

Ship the first learner-facing absolute-pitch experience that is visibly distinct from generic note guessing: first-run goal selection, a strict cold placement test, research-aligned AP training prompts with sampled timbres, level-gated feedback and replay, and an honest claims page. This is the wedge milestone—a new learner can enter the AP track, complete placement, and start practicing in one flow.

## Product Requirements

- Add a first-run goal picker with four choices: Absolute Pitch, Relative Pitch, Theory, Explore. Persist the selection to `localStorage` under `vibratone:goal`.
- Default new learners to the Absolute Pitch goal while allowing them to choose another.
- Add an AP placement test: 12 cold, timed, no-feedback prompts. Each prompt plays for `PLACEMENT_PROMPT_MS` (5 000 ms); if the learner does not respond in time, the prompt expires and advances with no answer recorded.
- Placement must avoid reference pitches, warm-up feedback, and answer reinforcement of any kind. The UI must not render any correctness indicator during placement—no "Correct", no "Not quite", no color change per guess.
- Add AP training mode with 800 ms stimulus duration (per the Wong protocol), level-gated feedback, level-gated replay, and pitch-class focus. No tonic drone or reference pitch is played before or after the stimulus.
- Add sampled piano and guitar prompt banks (consumed directly from the `SampledSynth` and `TimbreId` contract established in milestone 02).
- Add answer-training mode for Level 1 only: the learner can audition all eligible pitch classes by clicking them before committing a guess. Auditioning does not submit an answer and does not emit an `AttemptEvent`.
- Add wrong-answer replay at feedback-enabled levels: after an incorrect guess the app plays the original stimulus, then the correct pitch, and shows a `confusionExplanation` string computed from `learning/protocols/absolute-pitch.ts`.
- Add a claims page at `/claims` that explains what absolute pitch is, what Vibratone trains, what the research says, and what the product does not promise.

## User Experience Requirements

- A new learner can complete placement and enter a recommended AP session in one uninterrupted flow on a single page (`/`).
- The learner can replay prompts only where the current level permits it (`replayAllowed: true`); the Replay button is absent, not merely disabled, when the level forbids it.
- Placement, training, and claims must be understandable without a music-theory background.
- The AP mode must feel strict: no hidden reference pitch, no tonic drone, no relative-pitch setup, no warm-up round.
- The experience must work on desktop, tablet, and phone layouts at 375 × 667, 768 × 1024, and 1 280 × 800 viewports.
- Any timed-prompt indicator animation (countdown bar, pulse ring) must be suppressed or replaced with a static state indicator when `prefers-reduced-motion: reduce` is active, following the `.progress-fill` precedent in `practice-card.svelte`.

## Data and Analytics Requirements

This milestone owns the first `AttemptEvent` version bump. The v1 type from milestone 00 is preserved unchanged in `schema.ts`; a v2 variant is added as a discriminated union member.

**`AttemptEventV2` shape** (added to `src/lib/learning/drills/schema.ts`):

```ts
export type AttemptEventV2 = Omit<AttemptEventV1, 'version'> & {
	version: 2;
	/** Intended stimulus duration in ms. 800 for AP training; PLACEMENT_PROMPT_MS (5000) for
	 *  placement. Null is not used in v1: auditions never become AttemptEvents and are not logged. */
	promptDurationMs: number;
	/** True when the learner's level unlocks wrong-answer reveal after submission.
	 *  Always false during placement. Never equals AttemptEventV1.referenceAvailable,
	 *  which tracks whether a reference pitch was offered. */
	feedbackAvailable: boolean;
	/** Which prompt mode produced this attempt.
	 *  'replay' is not logged as a distinct event in v1: replaying a stimulus re-sounds audio
	 *  but does not create a new attempt. Auditions also do not produce events.
	 *  Only 'placement' and 'training' guesses become AttemptEvents. */
	promptKind: 'placement' | 'training';
};

export type AttemptEvent = AttemptEventV1 | AttemptEventV2;
```

`AttemptEventV1` is the type exported from milestone 00 as `AttemptEvent` (renamed here to `AttemptEventV1` to free the name for the union). The rename is backward-compatible: `appendAttemptEvent` and `loadAttemptLog` already accept `AttemptEvent`, so pointing them at the union is a non-breaking call-site update. No migration code is written—v1 events in storage remain valid historical data. The `localStorage` key `vibratone:attempts:v1` is append-only and accumulates both versions; consumers discriminate by `event.version`.

**v1 logging scope:** Only committed guesses (placement and training) produce `AttemptEvent`s. Replays (re-sounding the stimulus) and answer-training auditions do not log events. This is consistent with the milestone 00 replay-immutability precedent.

**`computeSemitoneError` helper** (exported from `schema.ts`):

```ts
/** Circular semitone distance: C vs B = 1, C vs F♯ = 6 (maximum). */
export function computeSemitoneError(guessed: PitchClass, correct: PitchClass): number {
	const raw = Math.abs((((guessed - correct) % 12) + 12) % 12);
	return Math.min(raw, 12 - raw);
}
```

`semitoneError` is computed at analytics read-time from `computeSemitoneError(event.answer, event.correctAnswer)`. It is not stored on the event.

**`promptId` convention for AP training:** `${pitch.pc}:${pitch.octave}:${levelId}:${roundIndex}`.

**`promptId` convention for placement:** `placement:${pitch.pc}:${pitch.octave}:${promptIndex}`.

All AP and placement `AttemptEvent`s carry `referenceAvailable: false`.

Individual-level data stays local unless the user explicitly exports it. Zero outbound network requests fire during any AP drill session.

## Accessibility Requirements

- Placement and AP training must be keyboard-only usable.
- The answer grid uses `role="group"` with an `aria-label="Choose a note"`, and 12 `<button>` elements each with `aria-pressed` and `aria-label` that includes both enharmonic spellings for black-key pitch classes (reusing `bothSpellings` from `src/lib/music.ts`).
- All 12 answer buttons are reachable by Tab; Enter or Space submits the answer.
- Sample playback controls expose `aria-busy="true"` while loading and a normal accessible name when ready, matching the milestone 02 stub pattern.
- The reveal region (wrong-answer feedback) uses `aria-live="polite"` and is empty during the guessing phase.
- The placement reveal region is permanently empty—no `aria-live` content is injected during active placement.
- Claims page content is fully readable without any visual chart. Charts, if present, are progressive enhancements over semantic text (`<p>`, `<dl>`, `<table>`).
- Focus rings must be visible on every interactive element throughout all three flows.

## Module and Architecture Targets

### Routing Model (Resolved)

Goal selection, placement, and AP training live on a single `src/routes/+page.svelte` driven by a `view` state (`'goal' | 'placement' | 'training'`). This preserves the existing factory-plus-context pattern: no new SvelteKit routes are needed for the core drill flow.

`/claims` is a separate prerendered route: `src/routes/claims/+page.svelte` with `export const prerender = true`.

No other new SvelteKit routes are introduced in this milestone.

### File Table

| File                                              | Action     | What lands there                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/learning/drills/schema.ts`               | **Modify** | Add `AttemptEventV2` type; update `AttemptEvent` union to `AttemptEventV1 \| AttemptEventV2`; add `computeSemitoneError(guessed, correct): number`; update type guard in `attempt-log.ts` to accept both versions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/lib/learning/protocols/absolute-pitch.ts`    | **Create** | `AP_LEVELS` as-const array; `APLevelConfig` type; `PlacementResult` type; `PLACEMENT_PROMPT_MS = 5000`; `scorePlacement(attempts): PlacementResult`; `confusionExplanation(guessedPc, correctPc): string`; `isAnswerTrainingLevel(level): boolean`; `isReplayPermitted(level): boolean`. No runes, no browser APIs—vitest server-project testable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/placement-state.svelte.ts`               | **Create** | `createPlacementState()` factory. Uses same `createContext`/`getPracticeState`-like pattern as `state.svelte.ts`. Generates the 12-prompt set at construction time (all 12 chromatic PCs, shuffled, no back-to-back repeat). Internally tracks correctAnswer per prompt but never exposes per-prompt correctness in its public API. `placementTimer: ReturnType<typeof setTimeout> \| undefined` is a plain `let` (not `$state`). On each guess: emits `AttemptEventV2` with `promptKind: 'placement'`, `feedbackAvailable: false`, `referenceAvailable: false`, `promptDurationMs: PLACEMENT_PROMPT_MS`; then calls `nextPrompt()` immediately without passing through any revealed phase. On timer expiry: calls `nextPrompt()` without emitting an event. After prompt 12: sets `placementResult: PlacementResult \| null` via `scorePlacement()`. `destroy()` clears `placementTimer`. |
| `src/lib/ap-state.svelte.ts`                      | **Create** | `createAPState(level: APLevelConfig)` factory. Follows the `createPracticeState` pattern: `$state` locals, plain-getter returns, persist-on-action (never `$effect`). `autoAdvanceTimer` is a plain `let`. Exposes `canReplay: boolean` (`$derived` from `level.replayAllowed`), `feedbackAvailable: boolean` (`$derived` from `level.feedbackLevel !== 'none'`), `answerTraining: boolean` (`$derived` from `level.answerTrainingAvailable`). `guess()` emits `AttemptEventV2` with `promptKind: 'training'`, `promptDurationMs: 800`, `feedbackAvailable`, `referenceAvailable: false`. `replay()` re-sounds the stimulus via `SampledSynth`; does not emit an event (replay-immutability precedent from milestone 00).                                                                                                                                                                  |
| `src/lib/persistence.ts`                          | **Modify** | Add `GOAL_KEY = 'vibratone:goal'`; `GoalId = 'absolute-pitch' \| 'relative-pitch' \| 'theory' \| 'explore'`; `isGoalId(v): v is GoalId`; `PLACEMENT_RESULT_KEY = 'vibratone:placement-result:v1'`; `isPlacementResult(v): v is PlacementResult`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/lib/components/answer-grid.svelte`           | **Create** | 12-button pitch-class answer grid. `role="group"`, `aria-label="Choose a note"`. Each button: `type="button"`, `aria-pressed={selected === pc}`, `aria-label` uses `bothSpellings` for black keys and `noteLabel` for white keys. Props: `onselect: (pc: PitchClass) => void`, `selected: PitchClass \| null`, `disabled: boolean`. Cinder #318 stub: 12 plain `<button>` elements with `.chip` class (same pattern as `setup-card.svelte`). One-import swap when #318 ships.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `src/lib/components/answer-training-panel.svelte` | **Create** | Audition surface for Level 1. Renders the eligible pitch classes as audition buttons. Clicking an audition button plays the pitch via `SampledSynth` (or `Synth` fallback) without submitting a guess. A separate "Submit my answer" button commits the selected candidate by calling `apState.guess(selectedPc)`. "Submit" is disabled until a candidate is selected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/lib/components/ap-practice-card.svelte`      | **Create** | AP training session card. Renders level indicator, Play button (with `aria-busy` from `samplerStatus`), optional Replay button gated on `canReplay`, answer grid, optional `answer-training-panel` when `answerTraining`, and a `role="polite"` reveal region that shows `confusionExplanation` text and triggers wrong-answer replay when `feedbackAvailable` is true and the guess was wrong.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/components/placement-card.svelte`        | **Create** | Placement flow card. No correctness indicator at any point. Shows prompt counter (`Prompt N of 12`). Reveal region is permanently empty. After prompt 12, shows `PlacementResult` summary (accuracy, recommended level label) and a "Start AP Practice" button that transitions `view` to `'training'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/lib/components/goal-selection.svelte`        | **Create** | First-run goal picker. Four goal cards: Absolute Pitch, Relative Pitch, Theory, Explore. `role="group"`, each card is `<button>`. Props: `onselect: (goal: GoalId) => void`, `selected: GoalId \| null`. Absolute Pitch is highlighted as default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/routes/+page.svelte`                         | **Modify** | Reads persisted `GoalId` from `localStorage` in `onMount` via `localStorageOrNull()`. When no goal is persisted, renders `<GoalSelection>`. When goal is `'absolute-pitch'` and no placement result is stored, renders `<PlacementCard>` (view=`'placement'`). When goal is `'absolute-pitch'` and placement is complete, renders `<APPracticeCard>` (view=`'training'`). Other goals render a "Coming soon" placeholder. `view` is `$state<'goal' \| 'placement' \| 'training'>('goal')`.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/routes/claims/+page.svelte`                  | **Create** | Static informational page. `export const prerender = true`. `<svelte:head>` with descriptive title and meta description. Sections: "What is absolute pitch?", "What Vibratone trains", "What the research says" (cites Wong, Cheung, Ngan & Wong 2025 by name), "What Vibratone does not promise". All content in SSR HTML as semantic `<p>`, `<dl>`, or `<table>`. Hedged language throughout: "may", "some evidence suggests", "results vary". The disclaimer must not use the literal phrase "perfect pitch"—use "absolute pitch" instead, as the grep gate forbids the former anywhere under `src/`.                                                                                                                                                                                                                                                                                   |
| `src/routes/claims/+page.ts`                      | **Create** | Universal `load` returning `{}` with `export const prerender = true`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**SSR safety invariant (inherited from milestone 00):** Every new file must contain no references to `window`, `document`, `localStorage`, `navigator`, or `requestAnimationFrame` at module initialization time. `placement-state.svelte.ts` and `ap-state.svelte.ts` guard all storage access with `localStorageOrNull()`.

**Svelte 5 state discipline:**

- `autoAdvanceTimer` and `placementTimer` in both new factories are plain `let` (not `$state`)—they are not reactive. Cleared in `destroy()`.
- `SampledSynth` instances are held as `$state.raw`.
- Both new factories use `createContext` (the type-safe `[get, set]` pair pattern from `state.svelte.ts`).
- Session state is persisted from action functions (`guess()`, `nextRound()`) not from `$effect`.

### AP Level Definitions

Milestone 04 ships four MVP AP levels. The full research-derived progression is a Non-Goal deferred to Research-Derived AP Level Progression.

```ts
// In src/lib/learning/protocols/absolute-pitch.ts

export type APLevelConfig = {
	id: string;
	label: string;
	eligiblePitchClasses: readonly PitchClass[];
	promptDurationMs: number; // 800 for all AP training levels (Wong protocol)
	replayAllowed: boolean;
	feedbackLevel: 'none' | 'name-only' | 'name-and-confusion';
	answerTrainingAvailable: boolean;
};

export const AP_LEVELS: readonly APLevelConfig[] = [
	{
		id: 'ap-1',
		label: 'Level 1 — White Keys',
		eligiblePitchClasses: [0, 2, 4, 5, 7, 9, 11], // C D E F G A B
		promptDurationMs: 800,
		replayAllowed: true,
		feedbackLevel: 'name-and-confusion',
		answerTrainingAvailable: true
	},
	{
		id: 'ap-2',
		label: 'Level 2 — White Keys, No Answer Training',
		eligiblePitchClasses: [0, 2, 4, 5, 7, 9, 11],
		promptDurationMs: 800,
		replayAllowed: true,
		feedbackLevel: 'name-only',
		answerTrainingAvailable: false
	},
	{
		id: 'ap-3',
		label: 'Level 3 — All 12 Pitch Classes',
		eligiblePitchClasses: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
		promptDurationMs: 800,
		replayAllowed: false,
		feedbackLevel: 'name-only',
		answerTrainingAvailable: false
	},
	{
		id: 'ap-4',
		label: 'Level 4 — All 12, No Replay',
		eligiblePitchClasses: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
		promptDurationMs: 800,
		replayAllowed: false,
		feedbackLevel: 'none',
		answerTrainingAvailable: false
	}
];
```

### Placement Scoring

```ts
export const PLACEMENT_PROMPT_MS = 5000;

export function scorePlacement(
	attempts: { correct: boolean; pitchClass: PitchClass }[]
): PlacementResult {
	const correctCount = attempts.filter((a) => a.correct).length;
	const totalPrompts = attempts.length; // 12
	// Level mapping: 0–3 correct → ap-1; 4–7 → ap-2; 8–12 → ap-3
	const recommendedLevelId = correctCount <= 3 ? 'ap-1' : correctCount <= 7 ? 'ap-2' : 'ap-3';
	// Per-PC accuracy: for each pitch class that appeared, correct attempts ÷ total attempts for that PC.
	// Pitch classes that never appeared are absent from the map (not present with value 0).
	const pcCounts: Record<number, { correct: number; total: number }> = {};
	for (const a of attempts) {
		const entry = pcCounts[a.pitchClass] ?? { correct: 0, total: 0 };
		entry.total += 1;
		if (a.correct) entry.correct += 1;
		pcCounts[a.pitchClass] = entry;
	}
	const accuracyByPitchClass: Record<number, number> = Object.fromEntries(
		Object.entries(pcCounts).map(([pc, { correct, total }]) => [pc, correct / total])
	);
	return {
		completedAt: Date.now(),
		totalPrompts,
		correctCount,
		accuracyByPitchClass,
		recommendedLevelId
	};
}

export type PlacementResult = {
	completedAt: number;
	totalPrompts: number;
	correctCount: number;
	accuracyByPitchClass: Record<number, number>;
	recommendedLevelId: string; // must be a valid AP_LEVELS id
};
```

### Placement Prompt Composition

`createPlacementState()` generates exactly 12 prompts covering all 12 chromatic pitch classes, one per class (the 13th would exceed 12, so no PC repeats by construction). Octave is drawn uniformly from octaves 4 and 5 (middle octave range). Prompts are presented in a deterministically shuffled order derived from the current `SESSION_ID` via `seededRandomInt` (from milestone 00), ensuring no back-to-back pitch-class repeat.

No warm-up prompts precede the 12 scored prompts. The factory must not re-order, remove, or replay scored prompts once generation is complete.

AP training prompt composition is driven by `level.eligiblePitchClasses` and the persisted `octaveLo`/`octaveHi` settings from `PersistedSettings` (milestone 02). When settings are unavailable, default to octaves 4–5. Each round selects one pitch class at random (with back-to-back repeat prevention) from `eligiblePitchClasses`.

### Confusion Explanation (v1)

```ts
/** v1: semitone-distance string. Richer labels are a later milestone concern. */
export function confusionExplanation(guessedPc: PitchClass, correctPc: PitchClass): string {
	if (guessedPc === correctPc) return '';
	const dist = computeSemitoneError(guessedPc, correctPc);
	const guessedName = noteLabel(guessedPc, 'sharp');
	const correctName = noteLabel(correctPc, 'sharp');
	if (dist === 1) return `You chose ${guessedName}, which is a semitone away from ${correctName}.`;
	return `You chose ${guessedName}, which is ${dist} semitones away from ${correctName}.`;
}
```

### Integration with Prior Milestone Contracts

**From milestone 00 (Drill Schema):**

- `DrillPrompt`, `AttemptEvent`, `appendAttemptEvent`, `SESSION_ID`, and `loadAttemptLog` are consumed directly from `src/lib/learning/drills/`.
- `promptId` convention above.

**From milestone 01 (Lookahead Audio Scheduler):**

- The 800 ms prompt duration is the `length` parameter passed to the scheduler's lookahead contract. AP prompts stop sounding at `AudioContext.currentTime + 0.8`. This is not a `setTimeout` delay.
- `stopAll()` is called on both `Synth` and `SampledSynth` at the start of each `nextRound()` to prevent audio overlap.

**From milestone 02 (Sample-Loading Capability):**

- `SampledSynth`, `TimbreId`, `loadSample`, `scheduleSample`, and the persisted `timbre` field in `PersistedSettings` are consumed directly.
- `canPlay` in both new state factories inherits the `samplerStatus === 'loading'` guard from milestone 02 so AP mode cannot start while a sample is decoding.

## Dependencies

- **Milestone 00 (Drill Schema, Attempt-Event Log, and Note-Trainer Conversion):** `DrillPrompt`, `DrillConfig`, `AttemptEvent` (v1), `appendAttemptEvent`, `loadAttemptLog`, `SESSION_ID`, `pitchClassEquals`, `seededRandomInt`, `localStorageOrNull`, and `SETTINGS_KEY`.
- **Milestone 01 (Lookahead Audio Scheduler):** The shared `AudioContext`, the lookahead scheduler `when` parameter contract, and the `stopAll()` ramp-down behavior. The 800 ms prompt duration is passed as the scheduler's `length` argument.
- **Milestone 02 (Sample-Loading Capability):** `SampledSynth`, `TimbreId` (`'sampled-piano' | 'sampled-guitar'`), `loadSample`, `scheduleSample`, `pitchToPlaybackRate`, and the persisted `timbre` field in `PersistedSettings`. All three milestones are required before milestone 04 begins.

## External Dependency Contracts

| Capability                                                      | What This Milestone Needs                                                            | Owner / Ticket                                                    | Stub / Mock Plan                                                                                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Large answer grid component                                     | 12 pitch-class buttons with `aria-pressed`, enharmonic labels, and feedback coloring | [Cinder #318](https://github.com/stevekinney/cinder/issues/318)   | Implement `answer-grid.svelte` as 12 plain `<button>` elements with `.chip` class (same pattern as `setup-card.svelte`). Same `aria-pressed`, `aria-label`, `bothSpellings` logic. One-import swap when #318 ships. |
| Media controls (play / replay with loading and disabled states) | Play button with `aria-busy`, `disabled`, and `aria-label` forwarding                | [Cinder #320](https://github.com/stevekinney/cinder/issues/320)   | Consume the milestone 02 stub directly: `<button disabled={samplerStatus !== 'ready'} aria-busy={samplerStatus === 'loading'} aria-label={...}>` with sibling `role="alert"` region. No new stub work needed.       |
| Pitch-class → note name and frequency                           | `noteLabel`, `bothSpellings`, `pitchToFrequency`, `isBlackPitchClass`                | `src/lib/music.ts` (already shipped)                              | No stub needed—already in use.                                                                                                                                                                                      |
| Octavian pitch-class factories                                  | `normalizePitchClass`, pitch name constants                                          | [Octavian #17](https://github.com/stevekinney/octavian/issues/17) | Already satisfied by `src/lib/music.ts` implementations (`SHARP_NAMES`, `FLAT_NAMES`, `normalizePitchClass`). Root octavian import works today.                                                                     |
| Web Audio scheduling helpers                                    | `scheduleSample` with `when` parameter                                               | [Octavian #32](https://github.com/stevekinney/octavian/issues/32) | Consume the milestone 02 stub directly: `sample-loader.ts` inline implementation with extraction comment.                                                                                                           |
| Sample assets (piano + guitar)                                  | Sampled prompt banks for AP training                                                 | `@lostgradient/music-assets` (future); decided in milestone 02    | Consume the milestone 02 stub directly. Same `static/samples/piano/` and `static/samples/guitar/` paths, same `route.fulfill()` Playwright intercept pattern (minimal WAV buffer).                                  |

## Acceptance Criteria

Each criterion is a concrete pass/fail check. Every criterion maps to at least one named test in the Test Plan section.

**AC-04-01 — First-run flow.** A first-time learner sees the goal picker, selects Absolute Pitch, completes 12 placement prompts, sees a placement summary with a recommended level, and enters an AP training session—all in one flow without navigating away from `/`. Verified by `ap-first-run: full flow from goal picker to AP training session`.

**AC-04-02 — Placement feedback suppression.** During all 12 placement prompts, no correctness indicator—text, color, icon, or ARIA content in the reveal region—is visible or announced. The reveal region is empty throughout. Verified by `ap-placement: reveal region is empty during all 12 placement prompts` and `placement-card: reveal region is never non-empty during active placement`.

**AC-04-03 — Attempt event fields.** Every `AttemptEvent` emitted during placement and AP training carries `version: 2`, `promptKind`, `promptDurationMs`, `feedbackAvailable`, and `referenceAvailable: false`. Verified by `drill-schema: AttemptEventV2 contains promptKind, feedbackAvailable, promptDurationMs fields` and `ap-placement: all placement AttemptEvents have version=2, promptKind=placement, feedbackAvailable=false`.

**AC-04-04 — No reference pitch.** At no point during AP placement or training is a tonic drone, reference pitch, or leading tone played. `referenceAvailable` is `false` on every emitted event. The AP state factory must not expose a `playTonic()` action. Verified by `ap-state: guess() emits AttemptEvent with referenceAvailable=false` and `ap-training: no tonic-drone or reference-pitch control visible`.

**AC-04-05 — Claims page language.** The claims page cites Wong, Cheung, Ngan & Wong 2025 by name and includes a disclaimer stating that the program cannot ensure every adult will develop absolute pitch. No source file under `src/` contains the phrases "perfect pitch", "guaranteed", or "will learn". Verified by `ap-claims: page contains citation text` and the grep gate.

**AC-04-06 — Piano and guitar prompts.** A full AP training round completes without error with both Piano and Guitar timbres active. Verified by `ap-training: AP session plays without error with Piano timbre active` and `ap-training: AP session plays without error with Guitar timbre active`.

**AC-04-07 — Replay gating.** The Replay button is present only when `level.replayAllowed` is `true` and absent (not merely disabled) when `false`. Verified by `ap-training: replay button absent when level.replayAllowed is false` and `ap-training: replay button present and functional when level.replayAllowed is true`.

**AC-04-08 — Level-gated feedback.** After an incorrect guess at a `feedbackLevel: 'name-and-confusion'` level, the reveal region shows the correct pitch name and a confusion explanation. At `feedbackLevel: 'none'`, the reveal region remains empty. Verified by `ap-training: reveal region shows confusion explanation when feedbackLevel=name-and-confusion` and `ap-training: reveal region empty when feedbackLevel=none`.

**AC-04-09 — Answer-training gating.** The answer-training panel is present and functional at Level 1 (`answerTrainingAvailable: true`) and absent at Level 2 and above. Clicking an audition button plays the pitch without submitting a guess and without emitting an `AttemptEvent`. Verified by `ap-training: answer-training panel present at level 1, absent at level 2+` and `answer-training-panel: clicking audition button does not call guess() or append AttemptEvent`.

**AC-04-10 — Responsive layout.** All three flows (goal selection, placement, AP training) complete without layout overflow or hidden interactive elements at 375 × 667, 768 × 1024, and 1 280 × 800 viewports. Verified by parameterized responsive smoke tests in `e2e/ap-responsive.e2e.ts`.

**AC-04-11 — Reduced-motion.** Any timed-prompt countdown animation is suppressed when `prefers-reduced-motion: reduce` is active. Verified by `ap-practice-card: countdown animation absent when prefers-reduced-motion is reduce`.

**AC-04-12 — Placement local-first.** After placement completes, `localStorage` contains the `PlacementResult` under `vibratone:placement-result:v1` and all placement `AttemptEvent`s under `vibratone:attempts:v1`. Zero outbound network requests fire during the placement session. Verified by `ap-placement: localStorage contains placement result and attempt events` and `ap-placement: zero outbound network requests during placement`.

**AC-04-13 — `computeSemitoneError` correctness.** The circular formula is correct: C vs B = 1 (not 11), C vs F♯ = 6 (maximum). Verified by `drill-schema: computeSemitoneError(0, 11) returns 1`, `drill-schema: computeSemitoneError(0, 6) returns 6`.

**AC-04-14 — SSR safety.** `bun run build` exits clean with no server-side browser-API reference errors in any file under `src/lib/learning/` or the new state factories. Verified by the `bun run build` gate command.

## Test Plan

### Unit Tests — Server Project (`src/lib/learning/drills/`)

**`drill-schema.spec.ts`** (additions to milestone 00's spec):

- `drill-schema: AttemptEventV2 version is the literal 2 (not number)`
- `drill-schema: AttemptEventV2 contains promptKind, feedbackAvailable, promptDurationMs fields`
- `drill-schema: AttemptEvent union discriminates on version field — version 1 matches V1, version 2 matches V2`
- `drill-schema: computeSemitoneError(0, 0) returns 0`
- `drill-schema: computeSemitoneError(0, 11) returns 1 (circular — C vs B)`
- `drill-schema: computeSemitoneError(0, 6) returns 6 (tritone — maximum)`
- `drill-schema: computeSemitoneError(6, 0) returns 6 (symmetric)`
- `drill-schema: AttemptEventV1 in localStorage does not break loadAttemptLog`

### Unit Tests — Server Project (`src/lib/learning/protocols/`)

**`absolute-pitch.spec.ts`**:

- `ap-levels: every APLevelConfig has a unique id`
- `ap-levels: eligiblePitchClasses values are all in range 0–11`
- `ap-levels: promptDurationMs is 800 for every AP training level`
- `ap-levels: AP_LEVELS contains at least 4 entries`
- `isAnswerTrainingLevel: returns true only for levels with answerTrainingAvailable=true`
- `isReplayPermitted: returns true only for levels with replayAllowed=true`
- `isReplayPermitted: returns false for levels with replayAllowed=false`
- `confusionExplanation: returns empty string when guessedPc equals correctPc`
- `confusionExplanation: returns a non-empty string for any pair of distinct pitch classes`
- `confusionExplanation: adjacent semitone (dist=1) produces "a semitone" phrasing`
- `confusionExplanation: non-adjacent (dist>1) produces semitone-count phrasing`
- `scorePlacement: 0 correct of 12 → recommendedLevelId is ap-1`
- `scorePlacement: 3 correct of 12 → recommendedLevelId is ap-1`
- `scorePlacement: 4 correct of 12 → recommendedLevelId is ap-2`
- `scorePlacement: 7 correct of 12 → recommendedLevelId is ap-2`
- `scorePlacement: 8 correct of 12 → recommendedLevelId is ap-3`
- `scorePlacement: 12 correct of 12 → recommendedLevelId is ap-3`
- `scorePlacement: recommendedLevelId is always a valid AP_LEVELS id`
- `scorePlacement: completedAt is set in returned PlacementResult`
- `PLACEMENT_PROMPT_MS: is 5000`

**`absolute-pitch.spec.ts`** (additional placement composition tests):

- `scorePlacement: returns exactly 12 totalPrompts when called with 12 attempts`
- `placement-prompts: no pitch class appears more than once across 12 generated prompts`
- `placement-prompts: no two consecutive prompts share the same pitch class`
- `placement-prompts: all 12 chromatic pitch classes appear exactly once in the generated set`
- `placement-prompts: accuracyByPitchClass contains only keys for pitch classes that appeared`
- `placement-prompts: accuracy value for a PC with 1 correct of 1 attempt is 1.0`
- `placement-prompts: accuracy value for a PC with 0 correct of 1 attempt is 0.0`

### Unit Tests — Client Project (`src/lib/placement-state.svelte.spec.ts`)

- `placement-state: guess() emits AttemptEventV2 with promptKind='placement'`
- `placement-state: guess() emits AttemptEvent with feedbackAvailable=false`
- `placement-state: guess() emits AttemptEvent with referenceAvailable=false`
- `placement-state: public API does not expose per-prompt correctness during active placement`
- `placement-state: public API does not expose guessedPc during active placement`
- `placement-state: prompt expiry advances to next prompt without emitting an AttemptEvent`
- `placement-state: placementResult is null until prompt 12 completes`
- `placement-state: placementResult.recommendedLevelId is a valid AP_LEVELS id after completion`
- `placement-state: destroy() clears any in-flight placementTimer`
- `placement-state: 12 guesses produce 12 AttemptEvents`

### Unit Tests — Client Project (`src/lib/ap-state.svelte.spec.ts`)

- `ap-state: guess() emits AttemptEventV2 with promptKind='training'`
- `ap-state: guess() emits AttemptEvent with promptDurationMs=800`
- `ap-state: guess() emits AttemptEvent with referenceAvailable=false`
- `ap-state: guess() emits AttemptEvent with feedbackAvailable matching level.feedbackLevel!=='none'`
- `ap-state: canReplay is false when level.replayAllowed is false`
- `ap-state: canReplay is true when level.replayAllowed is true`
- `ap-state: replay() does not emit an AttemptEvent`
- `ap-state: answer-training audition play does not call guess() and does not append an AttemptEvent`
- `ap-state: destroy() clears autoAdvanceTimer`

### Component Tests — Client Project (vitest-browser-svelte)

**`src/lib/components/answer-grid.svelte.test.ts`**:

- `answer-grid: renders 12 buttons`
- `answer-grid: each button has role="button" and aria-pressed`
- `answer-grid: selected button has aria-pressed=true, others have aria-pressed=false`
- `answer-grid: enharmonic pitch classes have dual-name aria-label (e.g. "C# or D♭")`
- `answer-grid: all buttons are disabled when disabled=true`
- `answer-grid: onselect is called with the correct PitchClass when a button is clicked`
- `answer-grid: all 12 buttons are reachable by Tab`

**`src/lib/components/placement-card.svelte.test.ts`**:

- `placement-card: reveal region is never non-empty during active placement`
- `placement-card: prompt counter shows correct N of 12`
- `placement-card: PlacementResult summary and Start AP Practice CTA visible after completion`
- `placement-card: reveal region has no ARIA content injected during all 12 placement prompts`

**`src/lib/components/goal-selection.svelte.test.ts`**:

- `goal-selection: renders four goal options`
- `goal-selection: Absolute Pitch option is highlighted by default`
- `goal-selection: onselect is called with the correct GoalId on click`
- `goal-selection: all four options are keyboard reachable via Tab`
- `goal-selection: selecting a goal persists to localStorage under vibratone:goal`

**`src/lib/components/ap-practice-card.svelte.test.ts`**:

- `ap-practice-card: answer grid renders 12 buttons`
- `ap-practice-card: Replay button present when level.replayAllowed=true`
- `ap-practice-card: Replay button absent when level.replayAllowed=false`
- `ap-practice-card: answer-training panel present when answerTrainingAvailable=true`
- `ap-practice-card: answer-training panel absent when answerTrainingAvailable=false`
- `ap-practice-card: reveal region is empty during guessing phase`
- `ap-practice-card: reveal region shows confusion explanation on wrong guess at name-and-confusion level`
- `ap-practice-card: reveal region empty on wrong guess at feedbackLevel=none`
- `ap-practice-card: countdown animation absent when prefers-reduced-motion is reduce`

**`src/lib/components/answer-training-panel.svelte.test.ts`**:

- `answer-training-panel: renders one audition button per eligible pitch class`
- `answer-training-panel: clicking audition button does not call guess() and does not append AttemptEvent`
- `answer-training-panel: Submit button is disabled before any candidate is selected`
- `answer-training-panel: Submit button becomes enabled after candidate selected`
- `answer-training-panel: Submit button calls state.guess() with selected PitchClass`

### Playwright E2E Tests (`e2e/`)

All e2e files use the `.e2e.ts` extension per `playwright.config.ts` (`testMatch: '**/*.e2e.{ts,js}'`).

**`e2e/ap-first-run.e2e.ts`**:

- `ap-first-run [1280×800]: first-time visitor sees goal picker with four options`
- `ap-first-run [1280×800]: Absolute Pitch is highlighted by default`
- `ap-first-run [1280×800]: selecting Absolute Pitch and continuing enters placement flow`
- `ap-first-run [1280×800]: placement flow shows Prompt N of 12 progress indicator`
- `ap-first-run [1280×800]: completing 12 placement prompts shows summary and Start AP Practice`
- `ap-first-run [1280×800]: clicking Start AP Practice enters AP training session`
- `ap-first-run [1280×800]: keyboard-only path — Tab to AP option, Enter, Tab to Start, Enter enters placement`
- `ap-first-run [375×667]: goal picker visible and operable without horizontal scroll`
- `ap-first-run [768×1024]: goal picker visible and operable without horizontal scroll`
- `goal-persists [1280×800]: reloading after choosing AP shows AP flow, not goal picker`

**`e2e/ap-placement.e2e.ts`**:

- `ap-placement [1280×800]: no correctness indicator visible during any of the 12 placement prompts`
- `ap-placement [1280×800]: reveal region remains empty during all 12 placement prompts`
- `ap-placement [1280×800]: no Replay button present during placement`
- `ap-placement [1280×800]: all 12 placement AttemptEvents have version=2, promptKind=placement, feedbackAvailable=false`
- `ap-placement [1280×800]: all 12 placement AttemptEvents have referenceAvailable=false`
- `ap-placement [1280×800]: after placement, vibratone:placement-result:v1 key present in localStorage`
- `ap-placement [1280×800]: zero outbound network requests during a full 12-prompt placement session`
- `ap-placement [1280×800]: answer grid keyboard path — Tab focuses first button, Tab moves, Enter submits`
- `ap-placement [1280×800]: completing placement shows PlacementResult summary without perfection-promise language`
- `ap-placement [375×667]: answer grid usable at 375px — no buttons clipped or hidden`
- `ap-placement [768×1024]: answer grid usable at 768px`

**`e2e/ap-session.e2e.ts`**:

- `ap-session [1280×800]: learner who completed placement can start an AP session in one flow`
- `ap-session [1280×800]: replay button absent when level.replayAllowed=false`
- `ap-session [1280×800]: replay button present and functional when level.replayAllowed=true`
- `ap-session [1280×800]: reveal region shows confusion explanation when feedbackLevel=name-and-confusion`
- `ap-session [1280×800]: reveal region empty when feedbackLevel=none`
- `ap-session [1280×800]: no tonic-drone or reference-pitch control visible at any point`
- `ap-session [1280×800]: stored AttemptEvents for training prompts have referenceAvailable=false`
- `ap-session [1280×800]: AP session plays without error with Piano timbre active`
- `ap-session [1280×800]: AP session plays without error with Guitar timbre active`
- `ap-session [1280×800]: zero outbound network requests during a 5-prompt training session`
- `ap-session [1280×800]: keyboard-only — Tab to Play, Enter, Tab to answer grid, Enter submits guess`
- `ap-session [375×667]: full training round completes without layout overflow`
- `ap-session [768×1024]: full training round completes without layout overflow`

**`e2e/ap-claims.e2e.ts`**:

- `ap-claims [1280×800]: claims page loads without JavaScript errors`
- `ap-claims [1280×800]: claims page contains citation text "Wong, Cheung, Ngan" and "2025"`
- `ap-claims [1280×800]: claims page does not contain "perfect pitch", "guaranteed", or "will learn"`
- `ap-claims [1280×800]: every img or svg has an accessible text alternative`
- `ap-claims [375×667]: all text readable without horizontal scroll`
- `ap-claims [1280×800]: keyboard-only — Tab reaches all links and interactive elements`

**`e2e/ap-responsive.e2e.ts`** (parameterized across 375 × 667, 768 × 1024, 1 280 × 800):

- `[width] answer grid visible and all 12 buttons keyboard-reachable`
- `[width] placement flow completes without layout overflow`
- `[width] AP session play → guess → auto-advance cycle completes`

### Acceptance Criterion → Test Mapping

| AC                                        | Verifying tests                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| AC-04-01 (first-run flow)                 | `ap-first-run: full flow from goal picker to AP training session`                                                        |
| AC-04-02 (placement feedback suppression) | `placement-card: reveal region never non-empty`; `ap-placement: reveal region remains empty during all 12 prompts`       |
| AC-04-03 (attempt event fields)           | `drill-schema: AttemptEventV2 contains fields`; `ap-placement: all placement events have version=2`                      |
| AC-04-04 (no reference pitch)             | `ap-state: guess() emits referenceAvailable=false`; `ap-session: no tonic-drone visible`                                 |
| AC-04-05 (claims language)                | `ap-claims: page contains citation text`; grep gate                                                                      |
| AC-04-06 (piano and guitar prompts)       | `ap-session: plays without error with Piano timbre`; `ap-session: plays without error with Guitar timbre`                |
| AC-04-07 (replay gating)                  | `ap-state: canReplay matches level`; `ap-session: replay button absent/present`                                          |
| AC-04-08 (feedback gating)                | `ap-practice-card: reveal region shows confusion at name-and-confusion level`; `ap-session: reveal region empty at none` |
| AC-04-09 (answer-training gating)         | `answer-training-panel: clicking audition does not call guess()`; `ap-session: panel present at L1, absent at L2+`       |
| AC-04-10 (responsive layout)              | `ap-responsive.e2e.ts` parameterized suite                                                                               |
| AC-04-11 (reduced-motion)                 | `ap-practice-card: countdown animation absent when prefers-reduced-motion is reduce`                                     |
| AC-04-12 (placement local-first)          | `ap-placement: localStorage contains placement result and events`; `ap-placement: zero outbound requests`                |
| AC-04-13 (computeSemitoneError)           | `drill-schema: computeSemitoneError(0,11) returns 1`; `drill-schema: computeSemitoneError(0,6) returns 6`                |
| AC-04-14 (SSR safety)                     | `bun run build` gate command                                                                                             |

### Fake-Timer Contract

All timing-sensitive tests use synthetic clocks:

- **Unit and component tests:** `vi.useFakeTimers()` in `beforeEach`; `vi.advanceTimersByTime(5000)` to expire a placement prompt; `vi.advanceTimersByTime(1600)` for AP auto-advance; `vi.runAllTimers()` in `afterEach`.
- **Playwright e2e:** `await page.clock.install({ time: 0 })` before navigation; `await page.clock.tick(5000)` to expire a placement prompt; `await page.clock.tick(1600)` for auto-advance, following the milestone 00 `page.clock.tick(1600)` pattern.

When a placement prompt expires, `placementTimer` fires `nextPrompt()` with no `AttemptEvent` emitted. The absence of an event for that prompt is asserted by counting events: 12 prompts with 10 answers and 2 timeouts → 10 events, not 12.

## Verification

Run these gate commands in order. All must exit clean before the milestone is declared complete:

```
bun run check
bun run build
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

**Grep gate (AP-claims guard, extending milestone 00):**

```bash
grep -rE "perfect pitch|guaranteed|will learn" src/
```

Must return no matches. The claims page uses hedged language ("may", "some evidence suggests", "results vary") and the disclaimer phrase "does not promise" — the word "promise" in honest context is not forbidden.

**Manual browser smokes (required before marking complete):**

- Chrome: complete the full first-run flow (goal → placement → AP training). Confirm no correctness indicator appears during placement.
- Chrome: switch to Guitar timbre in AP training, confirm audio is audibly distinct from Piano.
- Safari: same smoke as Chrome, confirming MP3 fallback path.
- Keyboard-only: navigate via Tab/Enter through goal picker, placement (Tab to answer grid, Enter to submit), and AP training Play/guess cycle.
- Screen reader (VoiceOver/NVDA): confirm reveal region is announced after a training guess and is silent during placement.
- Verify `vibratone:placement-result:v1` and `vibratone:attempts:v1` are populated correctly in DevTools → Application → Local Storage after a complete placement session.

## Non-Goals

- Do not add FSRS scheduling (deferred to Local FSRS and AP Analytics).
- Do not add the full research-derived AP level progression (deferred to Research-Derived AP Level Progression). MVP levels in `AP_LEVELS` are sufficient for this milestone.
- Do not add register scoring or singing-interval drills (deferred to Transfer, Register, and Singing).
- Do not add relative-pitch drills or microphone answer scoring.
- Do not add aggregate efficacy reporting or progress dashboards.
- Do not add multi-sample banks (one sample per octave)—deferred to Functional and Singer Tracks.
- Do not add richer confusion labels (tritone substitution, enharmonic pairs)—simple semitone-distance strings are sufficient for v1.
- Do not introduce accounts, a database, cloud sync, or any server-side state.
- Do not add notation exercises or staff-notation components.
- Do not add a daily puzzle or sharable session link for AP mode (deferred to Public AP Beta and Proof Loop).

## Completion Signal

Milestone 04 is complete when:

1. `bun run check`, `bun run build`, `bun run lint`, and `bun run test:unit -- --run` all exit clean with zero new failures.
2. All named unit tests in `src/lib/learning/protocols/absolute-pitch.spec.ts`, `src/lib/placement-state.svelte.spec.ts`, and `src/lib/ap-state.svelte.spec.ts` pass.
3. All named additions to `src/lib/learning/drills/drill-schema.spec.ts` pass.
4. All component tests in `src/lib/components/answer-grid.svelte.test.ts`, `placement-card.svelte.test.ts`, `goal-selection.svelte.test.ts`, `ap-practice-card.svelte.test.ts`, and `answer-training-panel.svelte.test.ts` pass.
5. All Playwright specs in `e2e/ap-first-run.e2e.ts`, `e2e/ap-placement.e2e.ts`, `e2e/ap-session.e2e.ts`, `e2e/ap-claims.e2e.ts`, and `e2e/ap-responsive.e2e.ts` pass.
6. All pre-existing `*.spec.ts` and `*.svelte.test.ts` tests remain green (zero regressions).
7. The grep gate returns no matches for AP-efficacy phrases.
8. A human has confirmed: (a) placement shows zero correctness feedback across all 12 prompts in Chrome; (b) Piano and Guitar timbres are audibly distinct in AP training; (c) the claims page does not contain any guarantee-of-absolute-pitch-development language.
9. `vibratone:placement-result:v1` and `vibratone:attempts:v1` are correctly populated in localStorage after a manual Chrome session.
