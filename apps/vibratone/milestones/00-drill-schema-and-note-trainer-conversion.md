# 00. Drill Schema, Attempt-Event Log, and Note-Trainer Conversion

## Outcome

No visible change for the learner: the note trainer behaves identically before and after this milestone. Internally, the trainer now runs on the shared drill schema and emits a versioned `AttemptEvent` to `localStorage` after each guess. This schema freeze is the prerequisite that prevents downstream schema and timing debt across milestones 01 through 09. All later milestones consume the types defined here.

Notation is confirmed in scope for the roadmap. The renderer (VexFlow, abcjs, or OSMD) is **not** chosen in this milestone—that decision is explicitly deferred to milestone 14 (Staff Notation Exercises), which is the first milestone that actually builds staff-notation exercises. No renderer is installed and no notation components are built here.

## Product Requirements

- Define a general drill model with `DrillPrompt`, `DrillConfig`, `DrillResult`, and `AttemptEvent` types that serve as the shared contract for all later milestones.
- Convert the existing single-note trainer into the first consumer of the drill schema without regressing any current behavior. `play()` must route through `createSeededSession` (or `createPrompt` with the seeded PRNG when no session list is needed) to produce a typed `DrillPrompt`, not call `createPrompt` directly.
- Build deterministic seeded prompt generation for repeatable sessions, daily puzzles, assignments, and share links. The seed is read from the URL search parameter `?seed=` in a universal SvelteKit `load` function so server and client render the same first prompt, preventing hydration drift.
- Emit a versioned `AttemptEvent` to `localStorage` under `vibratone:attempts:v1` after every guess. Zero outbound network requests fire during a drill session.
- The schema must include fields covering multi-note sequences and sampled timbres (so milestones 01 and 02 can consume a complete contract on day one), but playback of those types is not implemented here.

## User Experience Requirements

- The current learner-facing note drill continues to play, replay, accept answers, show correctness, update the score, and persist settings without any visible change to the user.
- Audio failures produce a recoverable visible state—not a blank or broken drill. When `getSynth()` returns `null` or `AudioContext` resumption fails, the state exposes `audioError: string | null` and `practice-card.svelte` renders it in a `role="alert"` region. The phase still transitions to `'guessing'` so the drill remains operable.
- The app remains usable on phone (375 × 667), tablet (768 × 1024), and desktop (1 280 × 800) widths without layout overflow or hidden interactive elements.
- Auto-advance fires 1 600 ms after a guess without manual interaction.

## Data and Analytics Requirements

**`AttemptEvent` type** (canonical flat shape, defined in `src/lib/learning/drills/schema.ts`):

```ts
export type AttemptEvent = {
	version: 1; // numeric literal — bump when shape changes; no migration code in this milestone
	drillId: string;
	promptId: string; // stable: `${pitch.pc}:${pitch.octave}:${seed ?? 'random'}`
	sessionId: string; // crypto.randomUUID() once per page load, at module init in attempt-log.ts
	timestamp: number; // Date.now(), ms since Unix epoch
	responseTimeMs: number; // prompt display → guess submission
	answer: PitchClass;
	correctAnswer: PitchClass;
	correct: boolean;
	pitchClass: PitchClass;
	octave: number;
	timbre: string; // 'sine' | 'warm' | 'piano' | sampled instrument label
	frequencyHz: number;
	referenceAvailable: boolean; // false for AP mode; true when a reference pitch was offered
	stimulusType: 'synthesized' | 'sampled' | 'sequence';
};
```

- `localStorage` key: `vibratone:attempts:v1` (append-only array of `AttemptEvent`).
- Existing aggregate score behavior (`scoring.ts`, `session`, `allTime`) is preserved unchanged. `AttemptEvent` supplements it; it does not replace it.
- Events remain local by default. Zero outbound network requests fire during a drill session.
- `sessionId` is generated once per page load with `crypto.randomUUID()` at module initialization time in `src/lib/learning/drills/attempt-log.ts`. It does not persist across page reloads.
- `promptId` for the note trainer is `${pitch.pc}:${pitch.octave}:${seed ?? 'random'}`, stable across replays of the same seeded session.

## Accessibility Requirements

- The current note drill remains fully keyboard operable: Tab reaches every piano key, Enter and Space submit the answer, focus rings are visible at all times.
- Audio controls (`play`, `replay`) carry accessible `aria-label` names and reflect disabled/loading states.
- The `aria-live="polite"` reveal region in `practice-card.svelte` contains the answer pitch name and a correctness indicator during the revealed phase, and is empty during the guessing phase.
- The auto-advance progress bar animation is suppressed when `prefers-reduced-motion: reduce` is set.
- Responsive smoke tests include a keyboard-only navigation path at desktop width.

## Module and Architecture Targets

| File                                        | Action        | What lands there                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/learning/drills/schema.ts`         | **Create**    | `DrillPrompt`, `DrillConfig`, `DrillResult`, `AttemptEvent` type definitions; `pitchClassEquals(a: PitchClass, b: PitchClass): boolean` helper (local enharmonic equivalence until Octavian #35 ships)                                                                                                       |
| `src/lib/learning/drills/seeded-random.ts`  | **Create**    | `seededRandomInt(seed: string): RandomInt` using mulberry32 (32-bit, deterministic across JS engines, no dependencies); re-exports `type RandomInt = (count: number) => number`                                                                                                                              |
| `src/lib/learning/drills/seeded-session.ts` | **Create**    | `createSeededSession(config: DrillConfig): DrillPrompt[]` — uses the existing `randomInt` injection point from `round.ts`; accepts `config.seed` for reproducible ordering                                                                                                                                   |
| `src/lib/learning/drills/attempt-log.ts`    | **Create**    | `appendAttemptEvent(event: AttemptEvent): void` and `loadAttemptLog(): AttemptEvent[]` backed by `localStorage` via `localStorageOrNull()` from `persistence.ts`; `SESSION_ID` constant (`crypto.randomUUID()` at module init)                                                                               |
| `src/lib/learning/drills/index.ts`          | **Create**    | Barrel re-exporting the public surface of the four files above                                                                                                                                                                                                                                               |
| `src/lib/state.svelte.ts`                   | **Modify**    | Wire `guess()` to construct and emit an `AttemptEvent` via `appendAttemptEvent`; route `nextRound()` through `createSeededSession`; accept an optional `seed: string \| null` parameter in the factory; expose `audioError: string \| null` state; preserve the entire existing public API surface unchanged |
| `src/routes/+page.ts`                       | **Create**    | Universal `load` function that reads `url.searchParams.get('seed')` and returns `{ seed: string \| null }`; runs on server and client so hydration never drifts                                                                                                                                              |
| `src/routes/+page.svelte`                   | **Modify**    | Read `data.seed` from `PageProps`, pass to `createPracticeState`; no visual changes                                                                                                                                                                                                                          |
| `src/lib/round.ts`                          | **No change** | `randomInt` injection is already the seeding seam                                                                                                                                                                                                                                                            |
| `src/lib/components/practice-card.svelte`   | **Modify**    | Render `audioError` in a `role="alert"` region when non-null; empty region when null                                                                                                                                                                                                                         |

No new routes beyond `+page.ts`. No database. No network calls. The `learning/scheduling`, `learning/analytics`, and `learning/protocols` directories are **not** created in this milestone.

**SSR safety invariant:** Every new file introduced here must contain no references to `window`, `document`, `localStorage`, `navigator`, or `requestAnimationFrame` at module initialization time. `attempt-log.ts` guards all storage access with `localStorageOrNull()` from `persistence.ts`.

**`autoAdvanceTimer` invariant:** The `autoAdvanceTimer` in `state.svelte.ts` must remain a plain `let` (not `$state`)—it is not reactive—and `destroy()` must continue to call `clearTimer()`. This invariant must survive the drill-schema conversion intact.

**`DrillConfig` type:**

```ts
export type DrillConfig = {
	drillId: string;
	seed?: string; // present for seeded/reproducible sessions
	eligiblePitchClasses: PitchClass[];
	octaveLo: number;
	octaveHi: number;
	timbre: string;
};
```

**`DrillPrompt` type:**

```ts
export type DrillPrompt = {
	promptId: string;
	pitchClass: PitchClass;
	octave: number;
	timbre: string;
	frequencyHz: number;
	stimulusType: 'synthesized' | 'sampled' | 'sequence';
};
```

**`DrillResult` type:**

```ts
export type DrillResult = {
	event: AttemptEvent;
	wasCorrect: boolean;
};
```

**Seeded PRNG seed format conventions:**

- Daily puzzle: `YYYY-MM-DD` (e.g. `'2025-01-15'`)
- Assignment: UUID v4 string
- Shareable session: base64url of `crypto.getRandomValues(new Uint8Array(8))`
- Unseeded practice: omit `seed`; `createPrompt` falls back to `Math.random()`

## Dependencies

This milestone has no dependencies on prior milestones. It is the foundation all others build on.

Milestones that depend on **this** milestone's types and contracts:

- **Milestone 01 (Lookahead Audio Scheduler)** — consumes `DrillPrompt` and `DrillConfig`; builds the lookahead audio scheduler and scheduled sequence playback on top of this schema.
- **Milestone 04 (AP Trainer MVP)** — consumes `DrillPrompt`, `AttemptEvent`, and `DrillConfig` to build the first learner-facing AP experience.
- **Milestone 05 (Local FSRS and AP Analytics)** — consumes the full `AttemptEvent` log as the scheduling input for FSRS.
- **All subsequent milestones** — consume `DrillConfig`, `DrillResult`, and `AttemptEvent` as the shared event vocabulary.

## External Dependency Contracts

| Capability                                  | Owner                                                             | Contract needed                                                                                              | Stub/mock plan                                                                                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pitch-class → note name and frequency       | Octavian (existing root export, wrapped in `src/lib/music.ts`)    | `pitchToFrequency(pitch: Pitch): number` and note-label helpers                                              | Already shipped and in use. No stub needed. `frequencyHz` in `DrillPrompt` is populated from `pitchToFrequency`.                                           |
| Deterministic drill generation (seeded RNG) | [Octavian #28](https://github.com/stevekinney/octavian/issues/28) | `seededRandomInt(seed: string): RandomInt` returning values in `[0, count)`, deterministic across JS engines | Implement locally in `src/lib/learning/drills/seeded-random.ts` using mulberry32 (15 lines, no dependencies). Replace with upstream export when #28 ships. |
| Answer comparison / enharmonic equivalence  | [Octavian #35](https://github.com/stevekinney/octavian/issues/35) | `pitchClassEquals(a: PitchClass, b: PitchClass): boolean` handling enharmonic equivalence                    | Implement locally in `schema.ts` as `a % 12 === b % 12`. Replace with upstream export when #35 ships.                                                      |
| Subpath export boundaries                   | [Octavian #34](https://github.com/stevekinney/octavian/issues/34) | Informational; governs where `learning/drills` code eventually lives                                         | No code blocked. Root import of `octavian` works today.                                                                                                    |

**Dependencies removed from milestone 00 (reassigned to later milestones):**

| Dependency                                    | Reassigned to                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Octavian #30 (sequence primitives)            | Milestone 01 (Lookahead Audio Scheduler) — lookahead audio scheduler and sequence playback           |
| Octavian #32 (web-audio rendering helpers)    | Milestone 02 (Sample-Loading Capability) — `AudioBufferSourceNode` scheduling and sample integration |
| Octavian #33 (pitch-estimate scoring helpers) | Milestone 03 (Microphone Pitch-Detection Spike) — cents deviation and pitch-estimate grading         |
| Cinder #320 (media controls)                  | Milestone 01 (Lookahead Audio Scheduler) — timed prompt playback controls                            |
| Cinder #321 (capability/permission states)    | Milestone 03 (Microphone Pitch-Detection Spike) — microphone permission state UI                     |

## Acceptance Criteria

Each criterion is a concrete pass/fail check with a named verifying test.

1. **Drill schema fields.** `play()` produces a `DrillPrompt` with a non-null `promptId`; `pitchClass` is within `eligiblePitchClasses`; `octave` is within `[octaveLo, octaveHi]`. Verified by `practice-card: emits AttemptEvent with valid DrillPrompt fields`.

2. **Score regression.** A correct guess increments `session.correct` and `allTime.correct` by 1. An incorrect guess increments `session.total` and `allTime.total` only. Existing `scoring.spec.ts` is the regression oracle; it must pass unchanged.

3. **Replay immutability.** `replay()` re-sounds the current pitch without mutating score, phase, or the attempt-event log. Verified by `practice-card: replay does not append an AttemptEvent`.

4. **Settings persistence.** `keyId`, `eligibleNotes`, `octaveLo`, and `octaveHi` survive a full page reload via `localStorage` under `SETTINGS_KEY`. Verified by the existing `persistence.spec.ts` regression suite.

5. **Auto-advance timing.** Auto-advance fires after 1 600 ms on the revealed phase and transitions to the next round without manual interaction. Verified by `note-drill-happy-path` Playwright test using `page.clock.tick(1600)`.

6. **Keyboard operability.** Piano keyboard answer surface is fully keyboard operable: Tab reaches each key, Enter/Space submits the answer, focus ring is visible. Verified by `note-drill-keyboard-path` Playwright test.

7. **Seeded reproducibility.** Given an identical string seed, `createSeededSession(config)` called twice returns arrays that `deepEqual` each other over N = 8 prompts. Verified by `seeded-session: identical seed yields identical prompt sequence`.

8. **Attempt-event log.** After a 5-drill session in a real browser, `localStorage['vibratone:attempts:v1']` contains exactly 5 `AttemptEvent` objects. Zero outbound network requests fire during the session. Verified by `note-drill-local-storage` Playwright test with `page.route()` interception.

9. **AttemptEvent completeness.** `AttemptEvent` objects in `localStorage` contain all required fields: `version`, `drillId`, `promptId`, `sessionId`, `timestamp`, `responseTimeMs`, `answer`, `correctAnswer`, `correct`, `pitchClass`, `octave`, `timbre`, `frequencyHz`, `referenceAvailable`, `stimulusType`. Verified by `drill-schema: AttemptEvent contains all required fields`.

10. **`AttemptEvent.version` literal.** `AttemptEvent.version` is the numeric literal `1` (not a wider `number` type). Verified by `drill-schema: AttemptEvent.version is the literal 1`.

11. **Audio failure state.** When `getSynth()` returns `null`, `play()` still transitions phase to `'guessing'` and the practice card renders a non-empty `role="alert"` region. Verified by `practice-card: audio error region is non-empty when audioError is set`.

12. **No AP-efficacy copy.** No UI string introduced or modified in this milestone contains the phrases "perfect pitch", "guaranteed", or "will learn". Verified by the grep gate in Verification.

13. **Responsive layout.** The note drill completes (play → guess → auto-advance) at all three breakpoints without layout overflow or hidden interactive elements. Verified by `note-drill-happy-path` Playwright test at 375 × 667, 768 × 1024, and 1 280 × 800 viewports.

14. **SSR safety.** `bun run check` exits clean with zero TypeScript errors, including no `window`/`document`/`localStorage` references at module init time in any file under `src/lib/learning/`. Verified by the `check` gate command.

## Test Plan

### Unit tests (`src/lib/learning/drills/`)

**`drill-schema.spec.ts`**

- `drill-schema: DrillPrompt round-trips through JSON without losing field types`
- `drill-schema: AttemptEvent.version is the literal 1`
- `drill-schema: AttemptEvent contains all required fields after a synthesized-note guess`
- `drill-schema: DrillConfig round-trips through JSON with all optional fields populated`
- `drill-schema: pitchClassEquals returns true for enharmonically equal pitch classes`
- `drill-schema: pitchClassEquals returns false for distinct pitch classes`

**`seeded-random.spec.ts`**

- `seededRandomInt: identical seed produces the same sequence on 100 repeated calls`
- `seededRandomInt: different seeds produce different sequences within 5 calls`
- `seededRandomInt: output is always in [0, count) for count in {1, 2, 12, 1000}`
- `seededRandomInt: successive calls return different values (not constant)`

**`seeded-session.spec.ts`**

- `seeded-session: identical seed yields identical prompt sequence (deepEqual over N=8 prompts)`
- `seeded-session: different seeds yield different sequences`
- `seeded-session: no prompt repeats back-to-back within the session (when pool > 1)`
- `seeded-session: every generated prompt has pitchClass within eligiblePitchClasses`
- `seeded-session: every generated prompt has octave within [octaveLo, octaveHi]`
- `seeded-session: returns empty array when eligiblePitchClasses is empty`

**`attempt-log.spec.ts`**

- `attempt-log: appendAttemptEvent appends to localStorage under vibratone:attempts:v1`
- `attempt-log: loadAttemptLog returns an empty array when localStorage has no key`
- `attempt-log: loadAttemptLog returns previously appended events in insertion order`
- `attempt-log: malformed localStorage value returns empty array without throwing`
- `attempt-log: SESSION_ID is a valid UUID v4 format`
- `attempt-log: SESSION_ID is stable within a module session (not re-generated on each call)`

### Regression tests (existing — must remain green, not modified)

- All `src/lib/round.spec.ts` tests
- All `src/lib/scoring.spec.ts` tests
- All `src/lib/music.spec.ts` tests
- All `src/lib/persistence.spec.ts` tests
- All `src/lib/audio.spec.ts` tests

### Component tests (vitest-browser-svelte)

**`src/lib/components/piano-keyboard.svelte.test.ts`** — all existing assertions pass (no changes).

**`src/lib/components/score-bar.svelte.test.ts`** — all existing assertions pass (no changes).

**`src/lib/components/octave-range-slider.svelte.test.ts`** — all existing assertions pass (no changes).

**`src/lib/components/practice-card.svelte.test.ts`** (new tests added):

- `practice-card: emits AttemptEvent to localStorage after a correct guess (mock localStorage)`
- `practice-card: emits AttemptEvent to localStorage after an incorrect guess`
- `practice-card: emits AttemptEvent with valid DrillPrompt fields`
- `practice-card: replay does not append an AttemptEvent`
- `practice-card: aria-live reveal region is empty during guessing phase`
- `practice-card: aria-live reveal region contains pitch name and "Correct" after a correct guess`
- `practice-card: aria-live reveal region contains pitch name and guessed note after an incorrect guess`
- `practice-card: audio error region is non-empty when audioError is set`
- `practice-card: audio error region is empty when audioError is null`
- `practice-card: auto-advance progress bar has no animation when prefers-reduced-motion is reduce`

**`src/lib/state.svelte.spec.ts`** (new tests, server project):

- `state: guess() emits AttemptEvent with correct:true when pc matches`
- `state: guess() emits AttemptEvent with correct:false when pc does not match`
- `state: guess() emits AttemptEvent with all required fields populated`
- `state: guess() does not emit AttemptEvent when phase is not guessing`
- `state: local event log grows by 1 on each guess() call`
- `state: destroy() clears any in-flight auto-advance timer after conversion to drill schema`
- `state: session.correct increments after a correct guess (regression)`
- `state: allTime.total increments after any guess (regression)`

### Playwright E2E tests (`e2e/`)

**`e2e/note-drill.spec.ts`**

- `note-drill-happy-path [375×667]: play → guess correctly → see reveal → auto-advance completes`
- `note-drill-happy-path [768×1024]: play → guess correctly → see reveal → auto-advance completes`
- `note-drill-happy-path [1280×800]: play → guess correctly → see reveal → auto-advance completes`
- `note-drill-keyboard-path [1280×800]: Tab to play button → Enter → Tab to piano key → Enter submits a guess → focus ring visible throughout`
- `note-drill-local-storage [1280×800]: after 5 guesses, localStorage contains 5 AttemptEvent objects under vibratone:attempts:v1 with no outbound network requests (page.route interception)`
- `note-drill-replay [1280×800]: replay button re-sounds without changing score or phase`
- `note-drill-seeded [1280×800]: loading /?seed=abc123 produces the same first prompt on two separate browser sessions`
- `note-drill-audio-error [1280×800]: when AudioContext is blocked, play() still transitions to guessing phase and does not render a blank state`

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

**Manual browser smokes:**

- Chrome: play 5 notes, guess each; open DevTools → Application → Local Storage; confirm `vibratone:attempts:v1` array has 5 entries with all required fields.
- Safari: same smoke as Chrome.
- Confirm that navigating to `/?seed=2025-01-15` produces the same opening note across two hard reloads.

## Non-Goals

- Do not build the lookahead audio scheduler (milestone 01, AP Trainer MVP).
- Do not implement sample loading with `decodeAudioData` / `AudioBufferSourceNode` (milestone 01, AP Trainer MVP).
- Do not prototype microphone pitch detection, `getUserMedia`, `AnalyserNode`, or `pitchy` integration (milestone 03, Microphone Pitch-Detection Spike).
- Do not add notation exercises or select a notation renderer (milestone 09, Theory and Notation Track). The decision is recorded as deferred: no renderer is installed or evaluated in this milestone.
- Do not add FSRS scheduling (milestone 02, Local FSRS and AP Analytics).
- Do not ship microphone scoring as a learner-facing feature.
- Do not introduce accounts, a database, cloud sync, or teacher workflows.
- Do not add AP-efficacy claims, "perfect pitch" promises, or research protocol copy to any UI.
- Do not write migration code for `AttemptEvent`; bump the `version` literal in a later milestone when the shape changes.
- Do not build a general-purpose `DrillEngine` class; the schema types and the seeded-session generator are the deliverable—the state machine stays in `state.svelte.ts`.
- Do not create `learning/scheduling`, `learning/analytics`, or `learning/protocols` directories; they wait for milestone 02 and later.

## Completion Signal

Milestone 00 is complete when:

1. `bun run check`, `bun run lint`, and `bun run test:unit -- --run` all exit clean with zero new failures.
2. All named unit tests in `src/lib/learning/drills/*.spec.ts` pass.
3. The new `src/lib/state.svelte.spec.ts` tests pass.
4. All pre-existing `*.spec.ts` and `*.svelte.test.ts` tests remain green (zero regressions).
5. The Playwright `note-drill-happy-path` and `note-drill-local-storage` specs pass at all three responsive breakpoints.
6. `AttemptEvent` objects are visible in `localStorage` under `vibratone:attempts:v1` after a manual browser session on Chrome and Safari.
7. `src/lib/learning/drills/index.ts` exports `DrillPrompt`, `DrillConfig`, `DrillResult`, and `AttemptEvent` as the shared contract for milestone 01 and beyond.
8. The grep gate returns no matches for AP-efficacy phrases.
