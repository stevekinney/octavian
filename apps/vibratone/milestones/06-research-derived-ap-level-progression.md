# 06. Research-Derived AP Level Progression

## Outcome

Replace generic AP settings with a credible, research-derived curriculum that introduces pitch classes in a controlled order, suppresses shortcuts, and advances only after measurable mastery of accuracy and response-time criteria.

## Product Requirements

- Implement a generative 288-level ladder derived from the Wong, Cheung, Ngan, and Wong 2025 protocol. The ladder is expressed as a 24-level block template instantiated per pitch—not 288 hand-authored records. A `LevelBlock` generator in `src/lib/learning/protocols/ap-level-block.ts` accepts the current pitch set size and returns typed sub-level definitions.
- Introduce pitch classes in the research-derived alternating-semitone order starting from F: F, F#, E, G, Eb, Ab, D, A, Db, Bb, C, B. Each pitch is the next adjacent semitone on alternating sides of the anchor. This sequence is exported as `AP_PITCH_INTRODUCTION_ORDER: ReadonlyArray<string>` from `src/lib/learning/protocols/ap-pitch-introduction.ts`.
- Pin the following protocol constants in `src/lib/learning/protocols/ap-level-block.ts`:

  | Parameter                       | Value                                                                                                   | Source                                      |
  | ------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
  | Total levels                    | 288                                                                                                     | Wong 2025 protocol                          |
  | Levels per added pitch          | 24                                                                                                      | Wong 2025 protocol                          |
  | Prompt duration                 | 800ms                                                                                                   | Wong 2025 protocol                          |
  | Response window at sub-level 1  | 4000ms                                                                                                  | Wong 2025 protocol (adapted)                |
  | Response window at sub-level 24 | 1500ms                                                                                                  | Wong 2025 protocol (adapted)                |
  | Window tightening               | ~104ms per sub-level (linear)                                                                           | Derived from start/end across 24 sub-levels |
  | Mastery accuracy threshold      | 90% accuracy over 30 consecutive trials at the current window                                           | Wong 2025 protocol                          |
  | Feedback-off sub-levels         | Final 4 of each 24-level block (sub-levels 21–24)                                                       | Wong 2025 protocol                          |
  | Out-of-bound tone sub-levels    | Sub-levels 1–6 of each 24-level block                                                                   | Wong 2025 protocol                          |
  | Shepard disruption              | Immediately before feedback-off sub-levels that follow a sample-listening phase                         | Wong 2025 protocol                          |
  | Delayed cold-pass gap           | 12 hours minimum, enforced via local timestamp                                                          | Wong 2025 protocol                          |
  | Level-jump trigger              | 95%+ accuracy and median response time 20%+ below the current window target, over 20 consecutive trials | PM decision                                 |
  | Stuck-state trigger             | 3 consecutive sessions below 70% accuracy on the current sub-level                                      | PM decision                                 |

- Include mastery thresholds based on accuracy and response time simultaneously—advancement must not be possible by trial count alone.
- Support feedback-on and feedback-off levels. During feedback-off sub-levels (sub-levels 21–24 of each 24-level block), the answer surface shows no correctness feedback—no color change, no correct/incorrect label, no sound effect—until the sub-level ends.
- Support timed response windows that tighten linearly within each 24-level block. The window resets to 4000ms when a new pitch is added and a new 24-level block begins. Any answer submitted after the response window closes is scored as a miss regardless of correctness.
- Add out-of-bound tones to sub-levels 1–6 of each 24-level block. Out-of-bound tones are pitch classes not currently in the training set for the current level block. They are played as stimuli, and the correct response is a dedicated "Other / not in set" button distinct from all pitch-class buttons. The purpose is to prevent high-versus-low frequency guessing strategies. The `SubLevel` type includes a boolean `includesOutOfBoundTones` per sub-level.
- Add Shepard-tone disruption before feedback-off sub-levels that follow a sample-listening phase. The system plays a Shepard tone before presenting the first no-feedback prompt in that transition.
- Add level-jumping: when accuracy is 95%+ and median response time is at least 20% below the current window target over 20 consecutive trials, the learner skips to the next level block's first feedback-on sub-level.
- Add stuck-state recovery: after 3 consecutive sessions below 70% accuracy on the current sub-level, the system offers two recovery options—(a) regress to the previous level block or (b) start a confusion-pair micro-drill targeting the two most-confused pitch classes. No fourth session starts until one option is selected.
- Add generalized confusion-pair micro-drills: a focused drill using only the two pitch classes with the highest confusion count from the attempt-event log.
- Show learner progress as pitch classes held at 90%+ accuracy under strict settings. Display the study benchmark (group average: 7 of 12 pitches reached at 90%+ accuracy; range 0–12; two participants reached all 12) as contextual framing—not as an implied target or ceiling. The UI must not present 12/12 pitch classes as the expected or normal outcome.
- Enforce the delayed cold pass for final mastery: when the learner passes the final sub-level of 12-pitch training for the first time, the system records a local ISO timestamp. The system blocks subsequent final-level attempts until `Date.now() - firstPassTimestamp >= 43_200_000` (12 hours). If a learner attempts early, the system displays the remaining time in hours and minutes.

## User Experience Requirements

- The learner always knows their current level index, active pitch set, mastery target (90% accuracy at the current response window), and why the next pitch was introduced. The `introductionRationale` field on each `SubLevel` is rendered in a `<details>` disclosure element on the level status component—accessible and testable, without creating visual clutter.
- A stuck learner receives a concrete recovery path (regress or confusion-pair drill) rather than repeated failure. The recovery panel is a native `<dialog>` element, keyboard-reachable, with focus trapped on open and `Escape` calling dismiss.
- Level advancement must feel earned: the system communicates mastery criteria plainly and shows whether both the accuracy and response-time gates have been met.
- Research-mode settings (current response window and feedback availability) are visible in a `role="status"` region labeled "Research Mode" whenever a strict-protocol level is active.
- The progress surface frames the learner's pitch-class count as personal progress. The benchmark text reads: "Group average in the source study: 7 of 12 pitches at 90%+ accuracy." No copy on the progress surface uses the phrase "goal," "target," or "expected" adjacent to the number 12.

## Data and Analytics Requirements

- Level attempt events are stored separately from free-practice attempts under the localStorage key `vibratone:level-attempts`. Free-practice events remain under their existing key.
- `LevelAttemptEvent` extends the `AttemptEvent` schema from Milestone 00 with a discriminant `drillType: 'ap-level'` plus the following additional fields:
  - `levelId: string` — canonical identifier for the 24-level block and sub-level position (e.g., `'block-03-sub-05'`)
  - `levelPhase: 'feedback-on' | 'feedback-off' | 'shepard-disruption'`
  - `pitchSetSize: number`
  - `responseWindowMs: number`
  - `isColdPass: boolean`
  - `isOutOfBound: boolean` — true when the prompt used an out-of-bound tone
  - `timedOut: boolean` — true when the answer was submitted after the response window closed
  - `feedbackAvailable: boolean`
  - `confusionDrill: boolean` — true when this attempt is part of a confusion-pair micro-drill
- Free-practice `AttemptEvent` records do not include `levelId`, `levelPhase`, `pitchSetSize`, or `isColdPass`. The distinction is enforced at the TypeScript type level.
- Track final-level mastery attempts and delayed cold passes. The cold-pass timestamp is stored under `vibratone:level-mastery` as a `LevelMasteryRecord`.
- Track level jumps and stuck-state interventions as separate event types under `vibratone:level-stuck-events`.
- Additional localStorage keys:
  - `vibratone:level-attempts` — `LevelAttemptEvent[]`
  - `vibratone:level-mastery` — `LevelMasteryRecord[]`
  - `vibratone:level-stuck-events` — `StuckStateRecord[]`
  - `vibratone:current-level-id` — `string`

## Accessibility Requirements

- Level progress and mastery state must be readable without visual-only progress bars. Mastery is expressed as a text count ("7 of 12 pitch classes mastered at 90%+ under strict settings"), not only as a graphical progress bar.
- The response-window countdown element carries `aria-hidden="true"` on the animated bar. A sibling `<div role="status" aria-live="polite" aria-atomic="true">` announces only at semantically meaningful moments: when the response window opens, at the 5-second warning, and when time expires. The live region text is minimal ("Response window open," "5 seconds remaining," "Time up") to avoid continuous screen-reader noise.
- The countdown container carries `role="timer"` with an `aria-label`. The component respects `prefers-reduced-motion` by suppressing animation on the visual bar, following the existing `practice-card.svelte` `.progress-fill` pattern.
- Recovery recommendations are keyboard-reachable. The stuck-state recovery panel renders inside a native `<dialog>` element with focus trapped on open. `Escape` calls `ondismiss`. All buttons have visible focus indicators.
- All level controls—advance, recover, regress, start confusion-pair drill—are reachable by keyboard alone.
- Answer surfaces for out-of-bound tones include a dedicated "Other / not in set" button with a clear `aria-label`.

## Module and Architecture Targets

### New files

| File                                                      | Responsibility                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/learning/protocols/ap-pitch-introduction.ts`     | `AP_PITCH_INTRODUCTION_ORDER` constant and a `pitchSetForSize(n: number): readonly string[]` helper                                                                                                                                                                                                                                                                                             |
| `src/lib/learning/protocols/ap-level-block.ts`            | `LevelBlock` type, `SubLevel` type, 24-level block generator, exported constants: `TOTAL_LEVELS`, `LEVELS_PER_PITCH`, `RESPONSE_WINDOW_START_MS`, `RESPONSE_WINDOW_END_MS`, `MASTERY_ACCURACY_FLOOR`, `MASTERY_MIN_TRIALS`, `LEVEL_JUMP_ACCURACY_THRESHOLD`, `LEVEL_JUMP_RT_THRESHOLD`, `LEVEL_JUMP_TRIAL_WINDOW`, `STUCK_SESSION_THRESHOLD`, `STUCK_ACCURACY_FLOOR`, `DELAYED_PASS_MIN_GAP_MS` |
| `src/lib/learning/protocols/ap-level-session.svelte.ts`   | `createApLevelSession()` factory — independent of `createPracticeState`; follows the same getter-object + `createContext` pattern from `src/lib/state.svelte.ts`; exposes `getLevelState`/`setLevelState` context pair                                                                                                                                                                          |
| `src/lib/learning/scheduling/level-state.ts`              | Current level state, advancement logic, level-jump detection, stuck-state detection (session-based), delayed cold-pass timestamp gate. Accepts injectable `now: () => number` for deterministic unit testing                                                                                                                                                                                    |
| `src/lib/learning/analytics/level-attempt-event.ts`       | `LevelAttemptEvent` type, `LevelMasteryRecord` type, `StuckStateRecord` type, type guards `isLevelAttemptEvent`, `isLevelMasteryRecord`, storage key constants                                                                                                                                                                                                                                  |
| `src/lib/learning/protocols/confusion-drill.ts`           | `buildConfusionQueue(attempts, threshold)` — pure function returning `ConfusionPair[]`; `generateConfusionPairDrill(pairs, count)`                                                                                                                                                                                                                                                              |
| `src/lib/audio/shepard.ts`                                | `playShepardTone(durationMs: number): Promise<void>` — starts as a stub returning `Promise.resolve()`; `shepardPartials(fundamentalHz: number): { frequency: number; gain: number }[]` for pure unit testing                                                                                                                                                                                    |
| `src/lib/components/level-status.svelte`                  | Current level index, active pitch set, mastery target as text, `introductionRationale` in a `<details>` disclosure, progress benchmark text                                                                                                                                                                                                                                                     |
| `src/lib/components/response-window-timer.svelte`         | Countdown with `aria-hidden` animated bar, `role="status"` live region at thresholds, `onexpired` callback                                                                                                                                                                                                                                                                                      |
| `src/lib/components/stuck-state-recovery.svelte`          | Native `<dialog>` recovery panel; keyboard-reachable; props `decision`, `onacceptlower`, `onacceptdrill`, `ondismiss`                                                                                                                                                                                                                                                                           |
| `src/lib/components/pitch-class-grid.svelte`              | Local stub: `<div role="grid">` with 12 `<button role="gridcell">` cells plus an "Other / not in set" button; replaced wholesale when Cinder #318 ships                                                                                                                                                                                                                                         |
| `src/lib/components/media-controls.svelte`                | Local stub: play and replay `<button>` elements with `aria-label` and `aria-pressed`; replaced when Cinder #320 ships                                                                                                                                                                                                                                                                           |
| `src/routes/ap/+page.svelte`                              | AP level-session route; calls `setLevelState(createApLevelSession(...))` on mount; renders `level-status`, `response-window-timer`, `pitch-class-grid`, `stuck-state-recovery`                                                                                                                                                                                                                  |
| `src/routes/ap/+page.svelte.test.ts`                      | Component tests for the AP route                                                                                                                                                                                                                                                                                                                                                                |
| `src/lib/components/level-status.svelte.test.ts`          | Component tests                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/lib/components/response-window-timer.svelte.test.ts` | Component tests                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/lib/components/stuck-state-recovery.svelte.test.ts`  | Component tests                                                                                                                                                                                                                                                                                                                                                                                 |

### Modified files

| File               | Change                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/round.ts` | Add `buildLevelPool(activePitches: Pitch[], outOfBoundPitches: Pitch[]): Pitch[]` — or add `additionalPitches?: Pitch[]` to the existing `buildPool` — to support out-of-bound tone injection |
| `src/lib/audio.ts` | Add `'shepard'` to the `Tone` union; add `Synth.#playShepard(frequency, length, now)` private method using `shepardPartials` from `src/lib/audio/shepard.ts`                                  |

### Key type contracts

**`LevelBlock` and `SubLevel`** (exported from `src/lib/learning/protocols/ap-level-block.ts`):

```ts
export type LevelBlock = {
	blockIndex: number; // 0-based index of this 24-level block
	pitchSetSize: number; // number of pitch classes active in this block
	subLevels: readonly SubLevel[];
};

export type SubLevel = {
	id: string; // e.g. 'block-02-sub-07'
	displayIndex: number; // 1-based for UI
	activePitchClasses: readonly string[];
	includesOutOfBoundTones: boolean; // true for sub-levels 1–6
	responseWindowMs: number; // 4000ms at sub-level 1, 1500ms at sub-level 24
	feedbackEnabled: boolean; // false for sub-levels 21–24
	hasShepardDisruption: boolean; // true when preceding level was sample-listening and this is feedback-off
	introductionRationale: string; // human-readable; empty string for non-introduction sub-levels
};
```

**`createApLevelSession` factory** (in `src/lib/learning/protocols/ap-level-session.svelte.ts`):

```ts
export type ApSessionPhase =
	| 'pre-level' // Shepard disruptor playing or intro shown
	| 'guessing' // response window open
	| 'revealed' // feedback shown (or blank if feedback disabled)
	| 'level-complete'
	| 'stuck' // recovery panel visible
	| 'cold-pass'; // delayed final-level mastery check

export type ApLevelSession = {
	readonly currentSubLevel: SubLevel;
	readonly phase: ApSessionPhase;
	readonly timeRemainingMs: number;
	readonly timeExpired: boolean;
	readonly stuckDecision: StuckStateDecision | null;
	readonly masteredPitchClasses: readonly string[];
	play(): void;
	guess(pitchClass: string): void;
	acceptLower(): void;
	acceptDrill(): void;
	dismissRecovery(): void;
	destroy(): void;
};
```

The factory uses a plain `setInterval` (not `$effect`) for the countdown, stored in a `let` variable, cleared in `destroy()`. The countdown lives in the factory, not in a component `$effect`. `timeRemainingMs` and `timeExpired` are `$state` primitives.

No-feedback levels suppress per-round correctness feedback by never transitioning to the `'revealed'` phase with answer display. Components render feedback conditionally:

```svelte
{#if state.phase === 'revealed' && state.currentSubLevel.feedbackEnabled}
	<!-- feedback content -->
{/if}
```

Stuck-state detection is session-based: the system counts how many consecutive sessions fell below 70% accuracy, not how many consecutive individual misses. This matches the product requirement exactly—a session is the unit of measurement.

## Dependencies

- **Milestone 05 — Local FSRS and AP Analytics**: This milestone consumes the FSRS card store and the attempt-event log API produced in Milestone 05. Specifically, `createApLevelSession` receives the FSRS card store as a constructor argument (not as a static import). The confusion-pair micro-drill inputs are derived from the `getConfusionMatrix()` API from Milestone 05's `learning/analytics` output. The `LevelAttemptEvent` type in this milestone extends the base `AttemptEvent` contract established in Milestone 00.
- **Milestone 04 — AP Trainer MVP** (via Milestone 05): The `createPrompt`/`buildPool` primitives from `src/lib/round.ts` and the `Synth` from `src/lib/audio.ts` are both consumed here. The existing `src/routes/+page.svelte` free-practice route is untouched; this milestone adds `src/routes/ap/+page.svelte` as a new route.

Nothing in this milestone reaches forward—transfer/register, microphone singing, and relative-pitch tracks are all stated non-goals. The dependency chain is clean and acyclic.

## External Dependency Contracts

| Capability                     | Contract                                                                                                                                                                                                                                                             | Owner                                                             | Stub/mock plan                                                                                                                                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deterministic drill generation | `generateDrills(seed: string, pitchSet: string[], count: number): Drill[]` — same seed + inputs must return identical sequence                                                                                                                                       | Octavian [#28](https://github.com/stevekinney/octavian/issues/28) | Implement `mulberry32` seeded PRNG (10-line pure function) in `src/lib/random.ts`; use it for a local `createSeededPromptSequence(seed, pitchSet, count)` in `src/lib/learning/protocols/ap-level-block.ts`. Delete and replace with the Octavian export when #28 ships.             |
| Answer grid component          | `items: PitchClassGridItem[]`, `onselect(pc: string): void`, per-item state `'correct' \| 'incorrect' \| 'selected' \| 'neutral'`, plus an "Other / not in set" item                                                                                                 | Cinder [#318](https://github.com/stevekinney/cinder/issues/318)   | `src/lib/components/pitch-class-grid.svelte` — local `<div role="grid">` with 12 `<button role="gridcell">` cells matching the Cinder prop interface. Replace wholesale when Cinder ships.                                                                                           |
| Media controls component       | `playing: boolean`, `onplay(): void`, `onreplay(): void`, accessible play/replay state                                                                                                                                                                               | Cinder [#320](https://github.com/stevekinney/cinder/issues/320)   | `src/lib/components/media-controls.svelte` — two `<button>` elements with `aria-label` and `aria-pressed`. Replace when Cinder ships.                                                                                                                                                |
| Shepard-tone generation        | `playShepardTone(durationMs: number): Promise<void>` — renders a Shepard tone using stacked sinusoids across octaves with a cosine-tapered amplitude envelope; `shepardPartials(fundamentalHz: number): { frequency: number; gain: number }[]` for pure unit testing | Vibratone-internal — `src/lib/audio/shepard.ts`                   | Stub: `export async function playShepardTone(_durationMs: number): Promise<void> {}` returns immediately. Wire real Web Audio synthesis before the first feedback-off level is exercised in e2e. No external ticket needed—this is a pure Web Audio primitive internal to Vibratone. |

## Acceptance Criteria

1. Given a learner who correctly identifies 27 of 30 consecutive prompts (90%) within the current response window, the system advances them to the next sub-level. Given a learner who identifies 26 of 30 (86.7%), the system does not advance.

2. Given a learner whose median response time over 20 consecutive trials is at least 20% below the current window target and accuracy is 95%+, the system skips to the next level block's first feedback-on sub-level.

3. Given a learner who completes three consecutive sessions below 70% accuracy on the same sub-level, the UI presents two recovery options: (a) regress to the previous level block or (b) start a confusion-pair micro-drill targeting the two most-confused pitch classes. No fourth session starts until one option is selected.

4. During feedback-off sub-levels (sub-levels 21–24 of each 24-level block), the answer surface shows no correctness feedback—no color change, no correct/incorrect label, no sound effect—until the sub-level ends. A Playwright test confirms zero visible feedback elements appear in response to any answer during a feedback-off sub-level.

5. Given a learner who has just completed a sample-listening phase and is about to enter a feedback-off sub-level, the system plays a Shepard tone before presenting the first no-feedback prompt. A unit test confirms `playShepardTone` is called exactly once in this transition.

6. Given a learner who passes the final sub-level of 12-pitch training for the first time, the system records a local ISO timestamp. If the learner attempts the delayed cold pass before 12 hours have elapsed, the system blocks the attempt and displays the remaining time in hours and minutes. After 12 hours, the attempt is permitted. A unit test with an injectable `now: () => number` verifies both the blocking and the unlocking conditions.

7. The pitch introduction order matches `AP_PITCH_INTRODUCTION_ORDER` exactly: F, F#, E, G, Eb, Ab, D, A, Db, Bb, C, B (adjacent semitones alternating above and below F). A unit test seeded at pitch-set-size 1 returns only F; size 2 returns F and F#; size 3 returns F, F#, and E.

8. Sub-levels 1–6 of each 24-level block have `includesOutOfBoundTones === true`. Sub-levels 7–24 have `includesOutOfBoundTones === false`. A unit test on the `LevelBlock` generator asserts these boundary values.

9. The response window at sub-level 1 of any block is 4000ms. The response window at sub-level 24 is 1500ms. A unit test on the `LevelBlock` generator asserts these boundary values. Any answer submitted after the response window closes is scored as a miss regardless of correctness.

10. `LevelAttemptEvent` records include `levelId`, `levelPhase`, `pitchSetSize`, `responseWindowMs`, and `isColdPass`. A unit test confirms that free-practice `AttemptEvent` records do not include these fields, enforced by TypeScript types.

11. The progress surface shows the learner's pitch-class count alongside the group benchmark text: "Group average in the source study: 7 of 12 pitches at 90%+ accuracy." A Playwright test confirms this benchmark text is present on the progress view. No copy on the progress surface uses the phrase "goal," "target," or "expected" adjacent to the number 12.

12. All level controls—advance, recover, regress, start confusion-pair drill—are reachable by keyboard alone. A Playwright accessibility test confirms focus reaches every actionable element without a mouse.

## Test Plan

### Unit tests — `src/lib/learning/protocols/ap-pitch-introduction.spec.ts`

- `ap-pitch-introduction: returns F as the first pitch`
- `ap-pitch-introduction: returns F, F# as the first two pitches`
- `ap-pitch-introduction: returns F, F#, E as the first three pitches`
- `ap-pitch-introduction: returns all 12 chromatic pitch classes in the defined order`
- `ap-pitch-introduction: each adjacent pair alternates sides of F by one semitone`

### Unit tests — `src/lib/learning/protocols/ap-level-block.spec.ts`

- `ap-level-block: total level count is 288`
- `ap-level-block: each 24-level block has exactly 24 sub-levels`
- `ap-level-block: sub-levels 1–6 have includesOutOfBoundTones === true`
- `ap-level-block: sub-levels 7–24 have includesOutOfBoundTones === false`
- `ap-level-block: sub-level 1 response window is 4000ms`
- `ap-level-block: sub-level 24 response window is 1500ms`
- `ap-level-block: response window is monotonically non-increasing across all 288 levels`
- `ap-level-block: response window never falls below 1500ms`
- `ap-level-block: feedback-off sub-levels are 21–24 of each 24-level block`
- `ap-level-block: shepard disruption flag is true for the sub-level immediately following a sample-listening phase before a feedback-off sub-level`
- `ap-level-block: shepard disruption flag is false for feedback-on sub-levels`
- `ap-level-block: each pitch introduction sub-level has a non-empty introductionRationale`
- `ap-level-block: the complete 12-pitch chromatic set is active by level 288`
- `ap-level-block: level-jump destination preserves the response window that corresponds to the destination level, not the origin level`

### Unit tests — `src/lib/learning/scheduling/level-state.spec.ts`

- `level-state: advances on 90% accuracy over 30 consecutive trials`
- `level-state: does not advance on 86.7% accuracy over 30 consecutive trials`
- `level-state: does not advance when accuracy meets threshold but trial count is below minimum`
- `level-state: does not advance when accuracy meets floor but median response time exceeds the current level window`
- `level-state: advances only when both accuracy and response-time criteria are met simultaneously`
- `level-state: does not count out-of-bound-tone attempts toward the qualifying attempt total`
- `level-state: level-jump detects clear outperformance (95%+ accuracy, response time 20%+ below target, 20 consecutive trials)`
- `level-state: does not level-jump below the outperformance thresholds`
- `level-state: computeJumpDestination returns a level higher than current + 1`
- `level-state: computeJumpDestination never returns a level beyond 288`
- `level-state: emitLevelJumpEvent writes a level-jump event with origin level, destination level, and timestamp`
- `level-state: stuck-state triggers after 3 consecutive sessions below 70% accuracy`
- `level-state: stuck-state does not trigger after 2 consecutive failing sessions`
- `level-state: recoveryRecommendation returns lower-level suggestion when no single confusion pair dominates`
- `level-state: recoveryRecommendation returns confusion-drill suggestion when a single confusion pair accounts for more than 50% of recent misses`
- `level-state: recoveryRecommendation never returns null when stuck-state is true`
- `level-state: delayed cold pass blocks attempts before 12h elapsed (injectable clock)`
- `level-state: delayed cold pass unlocks after 12h elapsed (injectable clock)`
- `level-state: answer after response window closes is scored as a miss`

### Unit tests — `src/lib/learning/analytics/level-attempt-event.spec.ts`

- `level-attempt-event: includes levelId, levelPhase, pitchSetSize, responseWindowMs, isColdPass`
- `level-attempt-event: isLevelAttemptEvent returns false for free-practice AttemptEvent records`
- `level-attempt-event: free-practice events do not include levelId or levelPhase`
- `level-attempt-event: recordLevelAttempt writes to vibratone:level-attempts, not the free-practice key`
- `level-attempt-event: recordLevelAttempt is append-only—two calls produce two events`
- `level-attempt-event: freePracticeAttempts does not include events stored by recordLevelAttempt`
- `level-attempt-event: confusionDrill field is true for events from a confusion-pair micro-drill`

### Unit tests — `src/lib/learning/protocols/confusion-drill.spec.ts`

- `confusion-drill: generateConfusionPairDrill uses the two pitch classes with the highest confusion count`
- `confusion-drill: returns at least one prompt`
- `confusion-drill: all prompts use only the two target pitch classes`
- `confusion-drill: repetition count is configurable and defaults to the named constant`
- `confusion-drill: throws when fewer than two distinct pitch classes exist in the confusion matrix`

### Unit tests — `src/lib/audio/shepard.spec.ts`

- `shepard: playShepardTone stub resolves immediately`
- `shepard: shepardPartials returns partials spanning the correct number of octaves`
- `shepard: shepardPartials amplitude values sum to the expected total gain`

### Component tests — vitest-browser-svelte

**`src/lib/components/level-status.svelte.test.ts`**

- `level-status: renders current level index as visible text`
- `level-status: renders active pitch set labels as text, not only as visual keyboard keys`
- `level-status: renders mastery target as a percentage string (not a visual-only bar)`
- `level-status: introductionRationale is hidden inside a details element and expandable`
- `level-status: mastered pitch-class count updates when masteredPitchClasses prop changes`
- `level-status: benchmark text is present and does not use the word goal, target, or expected adjacent to 12`
- `level-status: is keyboard-focusable—the level status region receives focus on Tab`

**`src/lib/components/response-window-timer.svelte.test.ts`**

- `response-window-timer: countdown element has aria-hidden="true"`
- `response-window-timer: live region announces window-open on mount`
- `response-window-timer: live region announces 5-second warning`
- `response-window-timer: live region does not update more than once per second (throttle assertion via fake timers)`
- `response-window-timer: fires onexpired when limit elapses`
- `response-window-timer: does not fire onexpired after the component is destroyed`

**`src/lib/components/stuck-state-recovery.svelte.test.ts`**

- `stuck-state-recovery: renders inside a dialog element`
- `stuck-state-recovery: traps focus within the dialog`
- `stuck-state-recovery: Escape key calls ondismiss`
- `stuck-state-recovery: lower-level recommendation button fires onacceptlower with correct levelId`
- `stuck-state-recovery: confusion-drill button fires onacceptdrill with correct pairs`

**`src/routes/ap/+page.svelte.test.ts`**

- `ap-route: renders level status on mount`
- `ap-route: renders the response window timer during guessing phase`
- `ap-route: does not render feedback content when currentSubLevel.feedbackEnabled is false`

### Playwright e2e — `e2e/ap-level-progression.spec.ts`

- `ap-level-progression: learner advances through a seeded feedback-on sub-level on hitting 90% threshold`
- `ap-level-progression: learner fails to advance when accuracy is 86.7% over 30 trials`
- `ap-level-progression: learner does not advance when accuracy meets floor but response time exceeds window`
- `ap-level-progression: level-jump emits a level-jump analytics event with destination level at least 2 above origin`
- `ap-level-progression: feedback-off sub-level shows no correctness indicator on any answer`
- `ap-level-progression: learner sees stuck-state recovery options after 3 failing sessions`
- `ap-level-progression: learner selects regress option and is moved to previous level block`
- `ap-level-progression: learner selects confusion-pair drill option and drill starts`
- `ap-level-progression: stuck-state recovery panel is reachable by keyboard only (no mouse)`
- `ap-level-progression: delayed cold pass shows remaining time when attempted before 12h (seeded backdated timestamp via page.evaluate)`
- `ap-level-progression: delayed cold pass permits attempt after 12h (seeded backdated timestamp via page.evaluate)`
- `ap-level-progression: out-of-bound tone receives Other / not in set button in sub-levels 1–6`
- `ap-level-progression: answer submitted after response window closes is scored as a miss`
- `ap-level-progression: level attempt events do not appear in free-practice confusion matrix`
- `ap-level-progression: progress surface displays study benchmark text alongside learner count`
- `ap-level-progression: progress surface contains no copy implying 12 is the expected outcome`
- `ap-level-progression: research-mode status region is visible and contains window and feedback text`
- `ap-level-progression: all level controls reachable by keyboard only`
- `ap-level-progression: Shepard tone is called exactly once before the first prompt of a feedback-off sub-level that follows sample listening`
- `ap-level-progression: responsive smoke at 375px, 768px, and 1280px widths for level status and timed answer UI`
- `ap-level-progression: timed-answer buttons have touch targets of at least 44×44px at 375px viewport`

## Verification

Run the global quality gates:

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

Manual smokes:

- Start the dev server and navigate to `/ap`. Confirm the level index, active pitch set, and response window are visible.
- Complete one trial and confirm the response window closes, the Shepard-tone flag fires at the correct transition, and feedback is suppressed during a feedback-off sub-level.
- Seed localStorage with a stuck-state and confirm the recovery dialog opens, is keyboard-navigable, and both options work.
- Seed localStorage with a final-level mastery timestamp 6 hours ago and confirm the cold-pass block message shows remaining time. Seed with 13 hours ago and confirm the pass is permitted.
- Check at 375px (phone), 768px (tablet), and 1280px (desktop) that no UI elements clip or overlap.
- Verify the progress surface shows the benchmark text and does not imply 12 is the expected outcome.

## Non-Goals

- Do not add full register scoring (trained in a later milestone).
- Do not add microphone singing.
- Do not add relative-pitch tracks.
- Do not claim the protocol guarantees AP acquisition. The claims page (from Milestone 04) continues to be the canonical honest-AP statement.
- Do not persist any data to a database (that boundary is the Database Foundation milestone).
- Do not require auth (that boundary is the Auth Foundation milestone).
- Do not present 12/12 pitch classes as the expected or normal outcome. The progress surface must not imply that stopping before 12 pitches constitutes failure.
- Do not extract the audio engine into a separate package this milestone—the `@lostgradient/browser-audio` package is a future consideration, not required here.
- Do not optimize FSRS parameters per learner (that is Milestone 05 scope).

## Completion Signal

This milestone is complete when the AP training path is a structured, research-aligned curriculum with strict level gates, shortcut suppression via out-of-bound tones, Shepard-tone disruption, stuck-state recovery, level-jumping, delayed cold-pass enforcement, and a progress surface that honestly frames results against the study benchmark—and when all named unit tests, component tests, and Playwright specs pass in CI.
