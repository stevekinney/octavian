# 01. Lookahead Audio Scheduler

## Outcome

No visible change for the learner. The lookahead audio scheduler ships as a new standalone module—`src/lib/audio-scheduler.ts`—and a developer-only smoke route proves it works end-to-end in a real browser. The existing single-note trainer is **not** rewired through the scheduler in this milestone; that integration is milestone 04 (AP Trainer MVP). No learner-facing UI changes ship here.

This milestone unlocks timed prompts, interval and arpeggio playback, drones, and the step sequencer in milestones 04 and 16. Milestone 02 (Sample-Loading Capability) depends on the `when`-parameter contract established here. Milestone 03 (Microphone Pitch-Detection Spike) has no dependency on this milestone.

Honest-AP posture: no learner-facing copy about perfect pitch, guaranteed outcomes, or efficacy claims is introduced or modified.

## Product Requirements

1. **Scheduler module.** Build `src/lib/audio-scheduler.ts` using `AudioContext.currentTime` plus a bounded `setInterval` lookahead loop. Default lookahead window: 100 ms. Default scheduler tick: 25 ms. Both values are named constants exported from the module and tuneable for tests.

2. **Thin, timbre-agnostic API.** The scheduler fires a caller-supplied `onEvent` callback for each `ScheduledEvent` that falls within the current lookahead window. The callback receives the event and the `AudioContext`; the caller wires nodes (`OscillatorNode`, `AudioBufferSourceNode`, etc.) to `context.destination`. The scheduler owns no knowledge of timbres, samples, or gain envelopes. This is the design that composes with milestone 02's `AudioBufferSourceNode` path without modification.

3. **Offset helper.** Export `toScheduledEvents(notes, startTime)` that converts an array of `{ frequencyHz, offsetSeconds, duration, gain? }` tuples into `ScheduledEvent[]` with absolute `AudioContext.currentTime` values. This is the stub for Octavian #30 until the upstream subpath ships.

4. **Shared `AudioContext`.** `createScheduler` receives the `AudioContext` from `getSynth()` as a constructor argument. It never creates its own `AudioContext`. Both the scheduler and `getSynth()` reference the same instance.

5. **Multi-note enqueue.** A sequence of N events must be enqueueable in a single call to `scheduler.enqueue(events)` without the caller managing timer state.

6. **Clean teardown.** `scheduler.stop()` clears the `setInterval`, prevents any further `onEvent` calls for already-enqueued events, and is idempotent (calling it twice does not throw).

7. **Developer smoke route.** Add `src/routes/scheduler-smoke/+page.svelte`, a developer-only route that renders a "Play 16-note diatonic sequence" button and a "Stop" button wired to the scheduler. This route is guarded by `if (!import.meta.env.DEV) redirect(307, '/')` in `src/routes/scheduler-smoke/+page.ts`, so it returns 307 in production. It is never linked from `+layout.svelte` or `AppHeader`.

## User Experience Requirements

- The existing note drill continues to play, replay, accept answers, show correctness, update the score, and persist settings without any change. No regression is acceptable.
- The smoke route is not linked from the application navigation. A developer accesses it directly at `/scheduler-smoke` in dev mode.
- The smoke route "Play" button is disabled during active sequence playback and re-enabled when the sequence ends or `Stop` is clicked.
- The smoke route "Stop" button stops audio within the `Synth`'s 60 ms ramp-down window.
- Audio failures on the smoke route produce a non-empty `role="alert"` region and disable the Play button rather than crashing the route.

## Data and Analytics Requirements

No new analytics events are emitted in this milestone. The `stimulusType: 'sequence'` variant already exists in the milestone 00 `AttemptEvent` schema—this milestone does not need to consume or produce it. No `localStorage` changes. No network requests.

## Accessibility Requirements

- The smoke route's "Play 16-note diatonic sequence" button carries `aria-label="Play 16-note diatonic sequence"` and `disabled` when a sequence is active.
- The smoke route's "Stop" button carries `aria-label="Stop sequence"` and `disabled` when no sequence is running.
- Both buttons are keyboard-operable: Tab reaches each, Enter/Space activates each, focus rings are visible.
- The existing note-drill keyboard-operability invariants from milestone 00 are unregressed.
- Responsive smoke at 375 × 667, 768 × 1024, and 1 280 × 800: smoke route controls are visible, not clipped, and buttons meet the 44 × 44 px touch-target minimum.

## Module and Architecture Targets

| File                                            | Action        | What lands there                                                                                                                    |
| ----------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/audio-scheduler.ts`                    | **Create**    | `createScheduler` factory; `ScheduledEvent` type; `toScheduledEvents` helper; `LOOKAHEAD_SECONDS` and `SCHEDULER_TICK_MS` constants |
| `src/lib/audio-scheduler.spec.ts`               | **Create**    | Unit tests using vitest fake timers and a `FakeAudioContext` mock                                                                   |
| `src/lib/audio/__mocks__/fake-audio-context.ts` | **Create**    | Minimal `AudioContext` subset for scheduler unit tests (see below)                                                                  |
| `src/routes/scheduler-smoke/+page.ts`           | **Create**    | Universal `load` function that redirects to `/` in production (`!import.meta.env.DEV`)                                              |
| `src/routes/scheduler-smoke/+page.svelte`       | **Create**    | Dev-only smoke UI: Play / Stop buttons wired to `createScheduler`; audio-error alert region                                         |
| `src/lib/audio.ts`                              | **No change** | `Synth`, `getSynth`, envelope helpers—unchanged                                                                                     |
| `src/lib/state.svelte.ts`                       | **No change** | `createPracticeState()` is not modified; scheduler integration is milestone 04                                                      |
| `src/lib/learning/`                             | **No change** | Not touched; scheduler is a platform primitive                                                                                      |

### `ScheduledEvent` type

```ts
/** A single timed playback event. */
export type ScheduledEvent = {
	/** Absolute AudioContext.currentTime value at which the event fires. */
	when: number;
	/** Frequency in Hz. Matches the convention in audio.ts and music.ts. */
	frequencyHz: number;
	/** Duration in seconds. */
	duration: number;
	/** Optional amplitude scalar 0–1; defaults to 1.0. */
	gain?: number;
};
```

### `createScheduler` factory contract

```ts
/**
 * Exported constants — change for testing, not for production.
 */
export const LOOKAHEAD_SECONDS = 0.1; // 100 ms
export const SCHEDULER_TICK_MS = 25; // 25 ms

/**
 * Create a lookahead audio scheduler. Fires a setInterval loop at
 * SCHEDULER_TICK_MS cadence and calls onEvent for each ScheduledEvent
 * whose `when` falls within the next LOOKAHEAD_SECONDS of
 * AudioContext.currentTime.
 *
 * Never constructs its own AudioContext. Receives the context from
 * getSynth() — caller is responsible for ensuring the context exists
 * inside a user gesture before calling enqueue().
 *
 * The onEvent callback is where the caller wires Web Audio nodes.
 * The scheduler is deliberately timbre-agnostic.
 */
export function createScheduler(
	context: AudioContext,
	onEvent: (event: ScheduledEvent, context: AudioContext) => void,
	options?: { lookaheadSeconds?: number; tickMs?: number }
): {
	enqueue(events: ScheduledEvent[]): void;
	stop(): void;
};
```

### `toScheduledEvents` helper (Octavian #30 stub)

```ts
/**
 * Convert an array of note descriptors (relative offsets) into ScheduledEvent[]
 * with absolute AudioContext.currentTime values.
 *
 * This is the local stub for octavian/sequences (#30). When #30 ships, replace
 * this with the upstream import and remove the local definition.
 * // extract to octavian/sequences (#30) when available
 */
export function toScheduledEvents(
	notes: ReadonlyArray<{
		frequencyHz: number;
		offsetSeconds: number;
		duration: number;
		gain?: number;
	}>,
	startTime: number
): ScheduledEvent[];
```

### `FakeAudioContext` mock

Located at `src/lib/audio/__mocks__/fake-audio-context.ts`. Implements the minimum subset of `AudioContext` needed by the scheduler:

```ts
export function createFakeAudioContext(startTime = 0): {
	currentTime: number; // mutable in tests — advance manually
	state: 'running' | 'suspended';
	resume(): Promise<void>;
	createOscillator(): OscillatorNode;
	createGain(): GainNode;
	destination: AudioDestinationNode;
};
```

All scheduler unit tests use `createFakeAudioContext` instead of a real `AudioContext`. Browser-only node-wiring tests remain Playwright-only.

### SSR safety invariant

Every file introduced by this milestone must satisfy all of the following:

- No reference to `window`, `AudioContext`, `requestAnimationFrame`, `setTimeout`, or `setInterval` at module initialization scope.
- All browser-API access is deferred to methods called inside user-gesture handlers, following the established pattern in `getSynth()` in `src/lib/audio.ts`.
- `bun run build` must complete without server-side reference errors. This gate is required in addition to `bun run check`.

The smoke route's `+page.ts` redirect is the SSR guard for the route; the scheduler module itself has no module-scope browser API calls.

### Timer coexistence note

The existing `autoAdvanceTimer` (1 600 ms `setTimeout`, one-shot, per-round) and the new scheduler interval (25 ms `setInterval`, continuous during sequence playback) are logically separate handles:

- `clearTimer()` in `state.svelte.ts` clears `autoAdvanceTimer` only.
- `scheduler.stop()` clears the scheduler interval only.

These two mechanisms are never merged. `state.svelte.ts` is not modified in this milestone.

### Svelte 5 state discipline

`createScheduler` returns a plain object with `enqueue` and `stop`—it contains no Svelte runes and does not live in a `.svelte.ts` file. It is an imperative browser object, like `Synth`. The smoke route's `+page.svelte` instantiates the scheduler inside the button `onclick` handler (inside the user gesture), following the pattern used by `getSynth()`.

## Dependencies

- **Milestone 00** (Drill Schema, Attempt-Event Log, and Note-Trainer Conversion): establishes the SSR-safety patterns (`getSynth()` lazy-init, `localStorageOrNull()`, `typeof window` guards) that this milestone follows. Consumes no types from milestone 00 directly—the scheduler is a platform primitive below the drill layer.

## External Dependency Contracts

| Capability                                              | Owner / Issue                                                     | Contract needed                                                                                                                                                                          | Stub/mock plan                                                                                                                                                                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Musical-time → schedulable events (sequence primitives) | [Octavian #30](https://github.com/stevekinney/octavian/issues/30) | `toScheduledEvents(notes, startTime): ScheduledEvent[]` converting relative `{ frequencyHz, offsetSeconds, duration, gain? }` tuples into absolute-`when` `ScheduledEvent[]`             | Implemented locally in `src/lib/audio-scheduler.ts` as a plain `map` loop: `notes.map(n => ({ ...n, when: startTime + n.offsetSeconds }))`. Annotated with `// extract to octavian/sequences (#30) when available`. Zero blocker. |
| Web Audio rendering helpers                             | [Octavian #32](https://github.com/stevekinney/octavian/issues/32) | Thin helper over `createBufferSource + connect + start` for scheduling `AudioBufferSourceNode`s                                                                                          | Not needed in milestone 01—sample playback belongs to milestone 02, which will stub this inline. This dependency passes through to milestone 02.                                                                                  |
| Subpath export packaging                                | [Octavian #34](https://github.com/stevekinney/octavian/issues/34) | Informational—governs where sequence primitives eventually live in Octavian                                                                                                              | No code blocked. Root import of `octavian` works today.                                                                                                                                                                           |
| Media controls (play/stop with loading/disabled states) | [Cinder #320](https://github.com/stevekinney/cinder/issues/320)   | Reassigned to milestone 04 (AP Trainer MVP)—no learner-visible UI ships in milestone 01. The smoke route uses plain `<button>` elements carrying `aria-label` and `disabled` attributes. | Plain `<button>` stub is sufficient and requires no Cinder component.                                                                                                                                                             |

## Acceptance Criteria

**AC-01-01 — Deterministic scheduling math**
A 16-note sequence processed through `createScheduler` fires `onEvent` for each event at the correct booked time: `event.when` equals `startTime + offsetSeconds` within ±1 ms tolerance when verified with a fake clock. Verified by: `audio-scheduler: each event's when equals startTime + offsetSeconds within 1ms` (vitest unit test with fake `AudioContext.currentTime`).

**AC-01-02 — Lookahead window respected**
`onEvent` is never called for an event whose `when` value is more than `LOOKAHEAD_SECONDS` seconds in the future from the current tick's `context.currentTime`. Verified by: `audio-scheduler: onEvent is not called for events beyond the lookahead window on the current tick` (vitest unit test).

**AC-01-03 — No double-firing**
Each event in the queue fires `onEvent` exactly once, even across multiple scheduler ticks. Verified by: `audio-scheduler: each enqueued event fires onEvent exactly once across multiple ticks` (vitest unit test).

**AC-01-04 — stop() is idempotent and complete**
After `stop()` is called, no further `onEvent` calls fire for previously enqueued events. Calling `stop()` twice does not throw. Verified by: `audio-scheduler: stop() prevents onEvent from firing after stop` and `audio-scheduler: stop() is idempotent — calling twice does not throw` (vitest unit tests).

**AC-01-05 — Shared AudioContext**
`createScheduler` uses the same `AudioContext` reference it was given; it constructs no second `AudioContext`. Verified by: `audio-scheduler: uses the AudioContext reference passed at construction` (vitest unit test asserting reference equality in the onEvent callback argument).

**AC-01-06 — toScheduledEvents produces correct absolute timestamps**
`toScheduledEvents` called with `startTime = T` and `offsetSeconds = D` for each note produces `ScheduledEvent[]` where each `when === T + D`. Verified by: `audio-scheduler: toScheduledEvents maps offsetSeconds to absolute when values` (vitest unit test).

**AC-01-07 — Empty sequence is a no-op**
`scheduler.enqueue([])` does not throw, fires no `onEvent` calls, and leaves the scheduler in a consistent state. Verified by: `audio-scheduler: enqueue with empty array does not throw and fires no onEvent` (vitest unit test).

**AC-01-08 — Note-trainer regression at three breakpoints**
The existing note-drill Playwright suite passes without modification at 375 × 667 (phone), 768 × 1024 (tablet), and 1 280 × 800 (desktop). Verified by the existing `note-drill-happy-path` Playwright spec at all three viewports (no changes to the spec).

**AC-01-09 — Smoke route is accessible and functional in dev**
In dev mode (`import.meta.env.DEV === true`), navigating to `/scheduler-smoke` renders the Play and Stop buttons. Clicking Play starts a 16-note sequence, disables the Play button, and enables the Stop button. Clicking Stop re-enables the Play button. Verified by: `scheduler-smoke: play/stop buttons toggle disabled state correctly` Playwright spec.

**AC-01-10 — Smoke route redirects in production**
In a production build, `GET /scheduler-smoke` returns a 307 redirect to `/`. Verified by: `scheduler-smoke: production build returns 307 for /scheduler-smoke` Playwright spec against `bun run preview`.

**AC-01-11 — SSR safety**
`bun run build` exits clean with zero server-side reference errors. No `window`, `AudioContext`, `setInterval`, or `setTimeout` reference appears at module initialization scope in any file introduced by this milestone. Verified by `bun run build` as a required gate command.

**AC-01-12 — Manual smoke (secondary confirmation)**
A 16-note diatonic sequence plays in Chrome and Safari with no audible stutter, gap, or doubling when the developer navigates to `/scheduler-smoke` and clicks Play. A human confirms this and records the result in the milestone completion note. This is secondary confirmation only; AC-01-01 is the CI gate.

**AC-01-13 — No AP-efficacy copy**
`grep -rE "perfect pitch|guaranteed|will learn" src/` returns no matches. Verified by the grep gate in the Verification section.

## Test Plan

### Unit tests (`src/lib/audio-scheduler.spec.ts`)

All unit tests use `createFakeAudioContext` with a manually advanced `currentTime`. They do not require a real browser or a real `AudioContext`. Vitest fake timers (`vi.useFakeTimers()`) drive the `setInterval` loop.

**Happy path and scheduling math:**

- `audio-scheduler: each event's when equals startTime + offsetSeconds within 1ms` (AC-01-01, AC-01-06)
- `audio-scheduler: onEvent is not called for events beyond the lookahead window on the current tick` (AC-01-02)
- `audio-scheduler: each enqueued event fires onEvent exactly once across multiple ticks` (AC-01-03)
- `audio-scheduler: 16 events spaced 100ms apart are all dispatched over the full sequence duration`
- `audio-scheduler: events with offsetSeconds 0 are scheduled in the first tick`
- `audio-scheduler: gain defaults to 1.0 when omitted from ScheduledEvent`
- `audio-scheduler: overlapping events (same when value) are both dispatched`

**Teardown and stop:**

- `audio-scheduler: stop() prevents onEvent from firing after stop` (AC-01-04)
- `audio-scheduler: stop() is idempotent — calling twice does not throw` (AC-01-04)
- `audio-scheduler: stop() before enqueue() is a no-op`

**Shared context:**

- `audio-scheduler: uses the AudioContext reference passed at construction` (AC-01-05)

**toScheduledEvents helper:**

- `audio-scheduler: toScheduledEvents maps offsetSeconds to absolute when values` (AC-01-06)
- `audio-scheduler: toScheduledEvents with empty input returns empty array`

**Edge cases:**

- `audio-scheduler: enqueue with empty array does not throw and fires no onEvent` (AC-01-07)
- `audio-scheduler: a second enqueue() before the first sequence ends replaces the pending queue`

**Constants:**

- `audio-scheduler: LOOKAHEAD_SECONDS is exported and equals 0.1`
- `audio-scheduler: SCHEDULER_TICK_MS is exported and equals 25`

### Regression tests (inherited from milestone 00 — must remain green, not modified)

- All `src/lib/audio.spec.ts` tests
- All `src/lib/round.spec.ts` tests
- All `src/lib/scoring.spec.ts` tests
- All `src/lib/music.spec.ts` tests
- All `src/lib/persistence.spec.ts` tests
- All `src/lib/learning/drills/*.spec.ts` tests
- All `src/lib/state.svelte.spec.ts` tests
- All `src/lib/components/*.svelte.test.ts` tests

### Playwright E2E tests (`e2e/scheduler-smoke.spec.ts`)

**Dev-mode happy path:**

- `scheduler-smoke [1280×800]: navigating to /scheduler-smoke renders Play and Stop buttons without console errors` (AC-01-09)
- `scheduler-smoke [1280×800]: clicking Play disables the Play button and enables Stop during playback` (AC-01-09)
- `scheduler-smoke [1280×800]: clicking Stop before sequence ends re-enables the Play button and stops audio` (AC-01-09)
- `scheduler-smoke [1280×800]: sequence completes without console errors or unhandled rejections`

**Keyboard path:**

- `scheduler-smoke [1280×800]: Tab to Play button, Enter starts sequence, Tab to Stop button, Enter stops mid-sequence; focus ring visible throughout`

**Responsive smoke:**

- `scheduler-smoke [375×667]: Play and Stop controls are visible, not clipped, and meet 44×44px touch-target minimum`
- `scheduler-smoke [768×1024]: Play and Stop controls are visible and not overflowing`
- `scheduler-smoke [1280×800]: Play and Stop controls are visible and not overflowing`

**Audio-context blocked:**

- `scheduler-smoke [1280×800]: when AudioContext construction is blocked (page.addInitScript stubs window.AudioContext to null), a non-empty role="alert" region is visible and Play button is disabled`

**Production redirect:**

- `scheduler-smoke production: GET /scheduler-smoke in a production preview returns 307 to /` (AC-01-10)

**Navigation cleanup:**

- `scheduler-smoke [1280×800]: starting a sequence and navigating away to / produces no console errors after navigating back` (scheduler interval is cleared on route teardown)

**Regression (existing specs — not modified):**

- `note-drill-happy-path [375×667]`: pass
- `note-drill-happy-path [768×1024]`: pass
- `note-drill-happy-path [1280×800]`: pass
- `note-drill-keyboard-path [1280×800]`: pass
- `note-drill-local-storage [1280×800]`: pass

## Verification

Run these gate commands in order. All must exit clean before the milestone is declared complete:

```
bun run check
bun run build
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

**Grep gate (AP-claims guard):**

```
grep -rE "perfect pitch|guaranteed|will learn" src/
```

This must return no matches.

**Grep gate (SSR safety):**

```
grep -rn "new AudioContext\|new AudioScheduler\|setInterval\|setTimeout" src/lib/audio-scheduler.ts
```

All matches must appear inside function bodies, not at module scope.

**Manual browser smoke procedure (Chrome and Safari):**

Open DevTools. Navigate to `/scheduler-smoke` in dev mode. Click "Play 16-note diatonic sequence." Confirm:

1. All 16 notes play sequentially with no audible gaps, stutters, or duplicated notes.
2. No `console.error` or unhandled-rejection entries appear in the DevTools console during or after playback.
3. Click "Stop" before a sequence ends. Confirm audio stops within approximately 60 ms (the `Synth` ramp-down window) and the Play button re-enables.
4. Navigate away to `/`. Navigate back to `/scheduler-smoke`. Confirm no orphaned-timer warnings appear.

Record the Chrome and Safari results in the milestone completion note before declaring milestone 01 complete.

## Non-Goals

- **Rewiring the existing note trainer.** The single-note trainer's `sound()` function in `state.svelte.ts` continues to call `getSynth().play()` directly. Routing it through the lookahead scheduler is milestone 04 (AP Trainer MVP), which introduces multi-note prompts and timed sequence playback for learners.
- **Sample loading and `decodeAudioData`.** Any use of `AudioBufferSourceNode` or `decodeAudioData` belongs to milestone 02 (Sample-Loading Capability). The scheduler in milestone 01 is tested only with synthesized oscillator callbacks; it has no knowledge of sample buffers.
- **Microphone, `getUserMedia`, `AnalyserNode`, `pitchy`, and pitch detection.** These belong to milestone 03 (Microphone Pitch-Detection Spike).
- **Notation renderer selection.** Resolved in milestone 00: notation is in scope for the roadmap; the renderer decision is explicitly deferred to milestone 14 (Staff Notation Exercises). Do not revisit here.
- **AP curriculum, levels, or placement tests.** These belong to milestone 04 (AP Trainer MVP).
- **FSRS scheduling.** Belongs to milestone 05 (Local FSRS and AP Analytics).
- **Cinder #320 (media controls).** Reassigned to milestone 04, where the first learner-visible sequence UI ships. The smoke route uses plain `<button>` elements.
- **Accounts, database, cloud sync, or teacher workflows.** No earlier than milestones 20 (Database Foundation) and 22 (Auth Foundation).
- **AP-efficacy copy.** No string containing "perfect pitch," "guaranteed," or "will learn" is added or modified.

## Completion Signal

Milestone 01 is complete when all five conditions hold simultaneously:

1. `bun run check`, `bun run build`, `bun run lint`, and `bun run test:unit -- --run` all exit clean with zero new failures.
2. All named scheduler unit tests in `src/lib/audio-scheduler.spec.ts` pass, including the scheduling-math and no-double-firing tests.
3. All milestone 00 regression tests remain green (zero regressions across unit, component, and Playwright suites).
4. The `e2e/scheduler-smoke.spec.ts` suite passes at all three responsive breakpoints, including the production-redirect spec.
5. A human has confirmed the 16-note manual smoke on Chrome and Safari (AC-01-12) and recorded the result in the milestone completion note.

`src/lib/audio-scheduler.ts` exports `createScheduler`, `toScheduledEvents`, `ScheduledEvent`, `LOOKAHEAD_SECONDS`, and `SCHEDULER_TICK_MS` as the stable contract for milestones 02 (Sample-Loading Capability) and 04 (AP Trainer MVP).
