# 07. Timbre Transfer Tests and Register Training

## Outcome

A learner who has completed at least one AP level-progression session can discover how well their pitch-class knowledge transfers to unfamiliar timbres and—optionally—whether they can identify the correct register (note plus octave) in addition to pitch class. Transfer tests are measurement-only: they never mutate FSRS card state, they never gate AP level advancement, and they never show per-trial correctness during the transfer round. Register training is opt-in from the free-practice surface, answers via the existing piano keyboard extended to three octaves, and likewise never gates advancement. Both features feed honestly reported analytics that a learner can consult at any time.

## Product Requirements

### Timbre Transfer Tests

- Implement a timbre-transfer measurement mode in `src/lib/learning/protocols/ap-transfer.ts`. A transfer session presents the trained pitch-class identification task with a non-trained timbre and records accuracy without altering FSRS scheduling or card state.
- Define **trained timbre** as `'sine'`—the default `Tone` value hard-coded by `audio.ts` and used by the AP level-progression protocol in milestone 06. Transfer timbres are: `'warm'` (sawtooth + low-pass, already in `Tone`), `'piano'` (triangle + octave partial, already in `Tone`), `'sampled-piano'` (requires milestone 02 sample-loading), and `'sampled-guitar'` (requires milestone 02 sample-loading). The two sampled timbres are loaded via the milestone 02 capability; until that capability lands, each substitutes the `'warm'` synth tone (see External Dependency Contracts).
- A transfer session contains exactly 36 prompts (3 per pitch class across all 12 pitch classes) randomized, with no timbre change mid-session. Prompt duration is 800ms, matching the training protocol.
- Transfer trials **must not** read or write any FSRS card field. The trial path bypasses `src/lib/learning/drills/attempt-log.ts`'s normal FSRS-update code path; attempts are appended to a separate storage key.
- Withhold per-trial correctness feedback during a transfer session: no color change, no correct/incorrect label, no sound effect after each trial. This matches the research rationale behind milestone 06's feedback-off sub-levels (sub-levels 21–24). Show aggregate accuracy only in the session-end summary.
- Transfer gap (accuracy on transfer timbres minus accuracy on trained timbre) is displayed honestly in the session summary: the value is never clamped or smoothed. A one-sentence caveat appears beneath the gap figure: "A transfer gap is normal—pitch-class knowledge generalizes more slowly to unfamiliar timbres than it does with the trained sound." The caveat copy is a constant, not a dynamic string.
- Sessions can be initiated only when the learner has at least one completed AP level-progression session (milestone 06 output). If no session history exists, the transfer entry point shows an informational message and disables the start button.

### Register Training

- Implement register training in `src/lib/learning/protocols/ap-register.ts`. A register trial presents a pitch-class prompt and requires the learner to identify both pitch class and octave via a three-octave piano keyboard (C3–B5).
- Register training is opt-in via a toggle on the free-practice surface (`src/routes/+page.svelte`). It never gates AP level advancement. The toggle state is persisted under `REGISTER_MODE_KEY = 'vibratone:register-mode'` using the same persistence layer as other learner settings.
- The three-octave keyboard is rendered by extending `src/lib/components/piano-keyboard.svelte` with a `multiOctave?: boolean` prop (default `false`). When `multiOctave` is `true`, the keyboard spans C3–B5 and emits a `Pitch` (pitch class + octave) value on key press. When `false`, behavior is unchanged—the keyboard emits a `PitchClass` value and the existing milestone-00 contract is preserved exactly.
- Register trial scoring uses `RegisterVerdict`: `'correct-register' | 'correct-pitch-class' | 'wrong'`. `'correct-register'` = both pitch class and octave match. `'correct-pitch-class'` = pitch class matches but octave is wrong. `'wrong'` = pitch class does not match. These three terms are the canonical names used throughout schema, analytics, and UI copy.
- The register answer surface provides a `role="status"` region that announces the verdict to screen readers immediately on key press.
- A dedicated register accuracy breakdown (pitch-class accuracy vs. full-register accuracy) is shown in the free-practice session summary when register mode is active.

## User Experience Requirements

- A **Transfer Tests** entry point is accessible from the free-practice route (`src/routes/+page.svelte`) via a clearly labeled button or link—not buried in settings. It is visible but not intrusive; it never auto-promotes itself during a training session.
- The transfer session start screen names the timbre to be tested and displays the learner's current trained-timbre accuracy (from the most recent completed AP level session) as a reference figure. Both pieces of information appear before the session begins.
- During a transfer session, no correctness signal of any kind appears after a trial. The prompt plays, the keyboard is presented, the learner responds, and the next prompt loads. The only delay is the 800ms tone playback.
- The session-end summary for a transfer session shows: total accuracy for this session, trained-timbre accuracy reference, and the computed transfer gap. The gap is labeled "Transfer gap" and is signed (positive when transfer accuracy exceeds trained, negative when it falls below).
- The register-mode toggle on the free-practice screen is labeled "Register training (note + octave)" and defaults to off. When activated, the keyboard area expands to three octaves without any other layout change to the practice card.
- During register training, the practice card displays a `trialKind` badge in the top-right corner: `'Register'` when register mode is active and `'Practice'` otherwise. During a transfer session, the badge displays the name of the timbre under test (e.g., `'Warm synth'`, `'Guitar'`).
- A transfer gap shown honestly is accompanied by a brief factual caveat: "A transfer gap is normal…" (see the constant in Product Requirements). The caveat is not an alert or warning—it renders as subdued body copy below the gap figure.
- Responsive layout at 390×844 (phone), 768×1024 (tablet), and 1280×800 (desktop). The three-octave keyboard scrolls horizontally on the 390px breakpoint; all keys remain reachable.

## Data and Analytics Requirements

- Extend the attempt-event union in `src/lib/learning/drills/schema.ts` with two new discriminated members. Each is stored under its own `localStorage` key, entirely separate from free-practice and level-progression events.

  ```typescript
  // src/lib/learning/drills/schema.ts — new discriminated members

  export type TransferAttemptEvent = {
  	readonly kind: 'transfer-attempt';
  	readonly version: 1;
  	readonly sessionId: string;
  	readonly drillId: string;
  	readonly promptId: string;
  	readonly timestamp: number; // Date.now()
  	readonly targetPitchClass: PitchClass;
  	readonly response: PitchClass;
  	readonly correct: boolean;
  	readonly trialKind: 'transfer';
  	readonly timbre: 'warm' | 'piano' | 'sampled-piano' | 'sampled-guitar';
  	readonly trainedTimbre: 'sine';
  };

  export type RegisterAttemptEvent = {
  	readonly kind: 'register-attempt';
  	readonly version: 1;
  	readonly sessionId: string;
  	readonly drillId: string;
  	readonly promptId: string;
  	readonly timestamp: number; // Date.now()
  	readonly targetPitch: Pitch; // pitch class + octave
  	readonly responsePitch: Pitch;
  	readonly verdict: RegisterVerdict;
  	readonly trialKind: 'trained' | 'pitch-class-only';
  };

  export type RegisterVerdict = 'correct-register' | 'correct-pitch-class' | 'wrong';
  ```

- Transfer attempts: storage key `TRANSFER_ATTEMPTS_KEY = 'vibratone:transfer-attempts'`, written by `appendTransferAttemptEvent` in `src/lib/learning/drills/attempt-log.ts`.
- Register attempts: storage key `REGISTER_ATTEMPTS_KEY = 'vibratone:register-attempts'`, written by `appendRegisterAttemptEvent` in `src/lib/learning/drills/attempt-log.ts`.
- The `trialKind` field on `TransferAttemptEvent` is always `'transfer'`. The `trialKind` field on `RegisterAttemptEvent` is `'trained'` when register mode is active alongside the standard AP trained-timbre prompt, or `'pitch-class-only'` when register mode is active but the session plays a non-trained timbre (included to handle a future edge case where no trained-timbre data exists yet).
- Free-practice `AttemptEvent` objects (milestone 00) are never read, written, or modified by this milestone. Level-progression `LevelAttemptEvent` objects (milestone 06) are never read, written, or modified by this milestone.
- Expose `computeTransferMetrics(events: TransferAttemptEvent[]): TransferMetrics` from `src/lib/learning/analytics/transfer-metrics.ts`. `TransferMetrics` contains: `trainedAccuracy: number`, `transferAccuracy: number`, `gap: number` (transfer minus trained), `timbre: string`, `sessionCount: number`. All values are derived at read time from stored events; none are persisted directly.
- The `gap` field in `TransferMetrics` is never clamped. A gap of `-0.42` is stored and displayed as `-0.42`.

## Accessibility Requirements

- The three-octave keyboard (`multiOctave={true}`) is fully keyboard-operable: each key maps to a keyboard shortcut (row A–J for white keys, row 1–0 for black keys within the visible octave); the current visible octave can be shifted left/right via `[` and `]`. Key labels and shortcut hints are visible in a `<details>` disclosure element labeled "Keyboard shortcuts".
- The scroll container for the three-octave keyboard on narrow viewports includes `role="region"` and `aria-label="Piano keyboard — scroll horizontally to see all octaves"`.
- The `trialKind` badge on the practice card is not the only means of communicating mode; a `role="status"` region announces the active mode when it changes (e.g., "Register training active" or "Transfer test: Warm synth").
- The `RegisterVerdict` response region uses `role="status"` and `aria-live="polite"`. It announces the verdict text (not a color or icon) on every trial response.
- The register-mode toggle is a native `<input type="checkbox">` with a visible label. It has a visible focus ring. State change is announced to screen readers via the checkbox's own semantics.
- Transfer session controls—start, end session—are keyboard-reachable via Tab and operable with Enter and Space.

## Module and Architecture Targets

**New modules** (create these files):

| File                                             | Exports                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `src/lib/learning/protocols/ap-transfer.ts`      | `createTransferSession()`, `TRANSFER_SESSION_LENGTH = 36`, `TRAINED_TIMBRE: 'sine'`, `TRANSFER_TIMBRES` |
| `src/lib/learning/protocols/ap-register.ts`      | `createRegisterSession()`, `REGISTER_MODE_KEY`, `scoreRegisterAttempt()`                                |
| `src/lib/learning/analytics/transfer-metrics.ts` | `computeTransferMetrics()`, `TransferMetrics` type                                                      |

**Modified modules** (touch only what the requirements above demand):

| File                                       | Change                                                                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/learning/drills/schema.ts`        | Add `TransferAttemptEvent`, `RegisterAttemptEvent`, `RegisterVerdict` as new discriminated union members; add `TRANSFER_ATTEMPTS_KEY`, `REGISTER_ATTEMPTS_KEY` constants; do not alter `AttemptEvent` or `LevelAttemptEvent` |
| `src/lib/learning/drills/attempt-log.ts`   | Add `appendTransferAttemptEvent()`, `appendRegisterAttemptEvent()`; existing functions are not touched                                                                                                                       |
| `src/lib/components/piano-keyboard.svelte` | Add `multiOctave?: boolean` prop; when `true`, render C3–B5 with horizontal scroll on narrow viewports; emit `Pitch` on key press; when `false`, existing behavior is unchanged                                              |
| `src/lib/components/practice-card.svelte`  | Add `trialKind` badge (top-right corner); add `role="status"` mode-change region                                                                                                                                             |
| `src/lib/state.svelte.ts`                  | Add `registerMode: boolean` field to `createPracticeState()`; add `transferActive: boolean`; follow existing factory-plus-context pattern—no module-level `$state`                                                           |
| `src/lib/persistence.ts`                   | Add `REGISTER_MODE_KEY`, `TRANSFER_ATTEMPTS_KEY`, `REGISTER_ATTEMPTS_KEY` storage key constants                                                                                                                              |
| `src/routes/+page.svelte`                  | Add register-mode toggle; add Transfer Tests entry point                                                                                                                                                                     |

**Do not create** a new SvelteKit route for transfer or register. Both surfaces live on the existing `src/routes/+page.svelte`.

**Factory-plus-context discipline:** Any new stateful logic introduced in this milestone follows the `createPracticeState()` pattern in `state.svelte.ts`: all `$state` variables live inside a factory closure, never at module level. State is made available via `createContext`/`getContext` as established in milestone 00.

## Dependencies

- dependsOn: `["06"]`
- track: `absolute-pitch`
- database: false
- auth: false

Milestone 07 depends on milestone 06 (Research-Derived AP Level Progression) for the `LevelAttemptEvent` schema pattern, the trained-timbre definition (sine, 800ms), and the learner session history used to gate the transfer entry point.

Milestone 07 does not depend on milestone 03 (microphone feasibility). Microphone input, pitch detection, and singing are milestone 08 concerns. Milestone 07 uses only discrete keyboard clicks.

Milestone 08 (AP Singing and Pitch Production) depends on milestone 07. It consumes the multi-octave keyboard answer surface introduced here as its mic-unavailable fallback, and it consumes the `TransferAttemptEvent`/`RegisterAttemptEvent` schema extension point when recording sung attempts as a further discriminated union member.

## External Dependency Contracts

| Dependency | Owned by | Contract this milestone needs | Stub until it lands |
| ----------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sample-loading capability (milestone 02) | Vibratone / milestone 02 | `loadSample(timbre: 'sampled-piano'                                                                               | 'sampled-guitar'): Promise<AudioBuffer>`exported from`src/lib/audio/samples.ts`; must resolve in < 2 s on a 10 Mbps connection | Substitute `'warm'` synth tone for both `'sampled-piano'` and `'sampled-guitar'`; display a `[!NOTE]` banner: "Using synth approximation — sample loading not yet available" |
| Cinder `#318` — `Chip` component (controlled, icon-slotted) | Cinder / `@lostgradient/cinder` issue #318 | `<Chip label={string} selected={boolean} on:click />` without internal toggle state; used for the timbre selector | Use a `<button>` with `aria-pressed` as an in-project stub in `src/lib/components/timbre-chip.svelte`; remove when Cinder #318 ships |

No dependency on Octavian. Frequency-to-note scoring (Octavian #26, #33, #35) is milestone 08 territory. Register answers here are discrete key presses, not acoustic measurements.

## Acceptance Criteria

| ID    | Criterion                                                                                                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-T1 | Transfer session presents exactly 36 prompts (3 per pitch class), all using the selected non-trained timbre, without correctness feedback during the session.                                       |
| AC-T2 | Transfer session summary shows trained-timbre accuracy, transfer accuracy, and an honest signed gap (never clamped); the transfer-gap caveat sentence is present.                                   |
| AC-T3 | Transfer attempts are stored under `TRANSFER_ATTEMPTS_KEY`; zero fields from any `AttemptEvent` or `LevelAttemptEvent` are modified as a side effect.                                               |
| AC-T4 | When no completed AP level-progression session exists, the Transfer Tests entry point is visible but its start button is disabled with an informational message.                                    |
| AC-T5 | `computeTransferMetrics()` returns a `gap` of exactly `transferAccuracy - trainedAccuracy` for any input; gap is never clamped.                                                                     |
| AC-R1 | When `multiOctave={true}`, `piano-keyboard.svelte` renders C3–B5 (36 keys); when `false`, it renders the original single-octave surface unchanged.                                                  |
| AC-R2 | A key press in `multiOctave` mode emits a `Pitch` (pitch class + octave); pitch class and octave together match the pressed key unambiguously.                                                      |
| AC-R3 | `scoreRegisterAttempt()` returns `'correct-register'` when both pitch class and octave match, `'correct-pitch-class'` when only pitch class matches, and `'wrong'` when pitch class does not match. |
| AC-R4 | Register attempts are stored under `REGISTER_ATTEMPTS_KEY`; zero fields from any `AttemptEvent` or `LevelAttemptEvent` are modified as a side effect.                                               |
| AC-R5 | Register mode toggle defaults to off; toggling it on shows the three-octave keyboard and persists the preference across page reloads.                                                               |
| AC-A1 | On 390×844 viewport, the three-octave keyboard is horizontally scrollable and all 36 keys are reachable by keyboard (`[`/`]` octave shift, A–J / 1–0 key shortcuts).                                |
| AC-A2 | Mode changes (register on/off, transfer session start) are announced via a `role="status"` region without requiring visual focus change.                                                            |
| AC-A3 | The `RegisterVerdict` is communicated via text in a `role="status"` region—not by color alone—on every trial.                                                                                       |

## Test Plan

All tests live in `src/lib/learning/` or co-located with modified components. Run with `bun test`.

### Coverage Map

| AC    | Test(s)                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------- |
| AC-T1 | `transfer-session.test.ts` — `generates exactly 36 prompts with 3 per pitch class`                              |
| AC-T1 | `transfer-session.test.ts` — `session emits no per-trial feedback event`                                        |
| AC-T2 | `transfer-metrics.test.ts` — `session summary fields present and correct`                                       |
| AC-T2 | `transfer-metrics.test.ts` — `caveat constant is non-empty string`                                              |
| AC-T3 | `transfer-attempt-log.test.ts` — `appendTransferAttemptEvent writes to TRANSFER_ATTEMPTS_KEY only`              |
| AC-T3 | `transfer-attempt-log.test.ts` — `free-practice and level-progression keys are untouched after transfer append` |
| AC-T4 | `transfer-entry-point.test.ts` — `start button is disabled when no level-progression session exists`            |
| AC-T4 | `transfer-entry-point.test.ts` — `start button is enabled after one completed level-progression session`        |
| AC-T5 | `transfer-metrics.test.ts` — `gap equals transferAccuracy minus trainedAccuracy exactly`                        |
| AC-T5 | `transfer-metrics.test.ts` — `negative gap is preserved without clamping`                                       |
| AC-R1 | `piano-keyboard.test.ts` — `renders 36 keys when multiOctave={true}`                                            |
| AC-R1 | `piano-keyboard.test.ts` — `renders original surface unchanged when multiOctave={false}`                        |
| AC-R2 | `piano-keyboard.test.ts` — `key press emits Pitch with correct pitchClass and octave`                           |
| AC-R3 | `ap-register.test.ts` — `scoreRegisterAttempt returns correct-register when pc and octave match`                |
| AC-R3 | `ap-register.test.ts` — `scoreRegisterAttempt returns correct-pitch-class when only pc matches`                 |
| AC-R3 | `ap-register.test.ts` — `scoreRegisterAttempt returns wrong when pc does not match`                             |
| AC-R4 | `register-attempt-log.test.ts` — `appendRegisterAttemptEvent writes to REGISTER_ATTEMPTS_KEY only`              |
| AC-R4 | `register-attempt-log.test.ts` — `free-practice and level-progression keys are untouched after register append` |
| AC-R5 | `register-mode-toggle.test.ts` — `toggle defaults to off on first load`                                         |
| AC-R5 | `register-mode-toggle.test.ts` — `toggling on persists under REGISTER_MODE_KEY`                                 |
| AC-R5 | `register-mode-toggle.test.ts` — `toggle state survives a page reload simulation`                               |
| AC-A1 | `piano-keyboard.test.ts` — `octave-shift keys [ and ] change the visible octave`                                |
| AC-A1 | Playwright `e2e/register-keyboard.spec.ts` — all 36 keys reachable at 390×844 via keyboard                      |
| AC-A2 | `practice-card.test.ts` — `mode change announces via role=status region`                                        |
| AC-A3 | `practice-card.test.ts` — `RegisterVerdict text appears in role=status region`                                  |

### Unit tests (vitest / `bun test`)

- `src/lib/learning/protocols/ap-transfer.test.ts`
  - `createTransferSession()` returns a session object with `prompts.length === 36`
  - Each pitch class appears exactly 3 times in `prompts`
  - All prompts carry the requested `timbre`, never `'sine'`
  - Session does not touch the FSRS card store

- `src/lib/learning/protocols/ap-register.test.ts`
  - `scoreRegisterAttempt()` — all three verdict branches (see AC-R3)
  - `createRegisterSession()` — prompts cover all target pitches in C3–B5

- `src/lib/learning/analytics/transfer-metrics.test.ts`
  - `computeTransferMetrics()` — correct arithmetic, negative gap preserved, zero gap allowed
  - `trainedAccuracy`, `transferAccuracy`, and `sessionCount` are correct from a fixture of events

- `src/lib/learning/drills/attempt-log.test.ts` (additive tests only—do not alter existing tests)
  - `appendTransferAttemptEvent` / `appendRegisterAttemptEvent` — correct key isolation

- `src/lib/components/piano-keyboard.test.ts` (additive tests only)
  - `multiOctave={true}` key count, emitted `Pitch` shape, octave-shift key handling
  - `multiOctave={false}` backward-compatibility (existing test suite must remain green)

- `src/lib/components/practice-card.test.ts` (additive tests only)
  - `trialKind` badge renders correct text per mode
  - `role="status"` region content updates on mode change

### Playwright end-to-end (390×844 viewport)

- `e2e/register-keyboard.spec.ts` — tab to each key in the three-octave keyboard; confirm all 36 keys are reachable; confirm `[`/`]` shifts the octave

## Verification

Before this milestone is marked complete:

1. `bun test` passes with zero skipped tests and zero suppressed assertions.
2. All acceptance criteria in the table above have a green test mapped to them in the coverage-map table.
3. `piano-keyboard.svelte` in `multiOctave={false}` mode passes its full existing test suite without modification.
4. No `AttemptEvent` or `LevelAttemptEvent` field is mutated or overwritten by any code path introduced in this milestone—confirmed by the key-isolation tests in `attempt-log.test.ts`.
5. The transfer-gap figure in a manually driven transfer session shows the raw signed value; a 100% correct transfer run against 80% trained accuracy shows `+0.20`, not `0.20`, not `0.2`, not a clamped `0`.
6. A Playwright run at 390×844 confirms all 36 register keys are keyboard-reachable.
7. `bun run check` (TypeScript + Svelte type checking) reports zero errors.
8. The `trialKind` badge displays correct text in all three modes: `'Practice'`, `'Register'`, and the active transfer-timbre name.

## Non-Goals

- Microphone input, pitch detection, frequency scoring, or sung attempt events — milestone 08.
- Octavian integration of any kind (Octavian #26, #33, #35) — milestone 08.
- Cinder #321 (mic permission indicator), Cinder #324 (pitch meter shell) — milestone 08.
- Wiring transfer or register into the `/ap` level-progression curriculum (`src/routes/ap/+page.svelte`) — out of scope; the `/ap` route is owned by milestone 06 and is not modified here.
- FSRS card mutation or scheduling changes — all transfer and register attempts bypass FSRS entirely.
- Singing feedback, `SungAttemptEvent`, or any acoustic scoring — milestone 08.
- Database or server persistence — no database until milestone 20.
- Authentication — no auth until milestone 22.
- Octave-error detection via acoustic analysis (heard pitch doubling) — milestone 08.
- Timbre playback fidelity improvements, sample panning, reverb, or reverb tail shaping — out of scope for this roadmap; not scheduled in any milestone.

## Completion Signal

A learner can open the free-practice screen, activate register training via the toggle, play a pitch from C3–B5, respond on the three-octave keyboard, and see an accurate `RegisterVerdict`. They can then navigate to the Transfer Tests entry point, start a session with a non-trained timbre (e.g., Warm synth), complete all 36 trials with no per-trial feedback, and arrive at a session summary showing their trained-timbre accuracy, transfer accuracy, and honest signed transfer gap alongside the caveat sentence. All acceptance criteria are green, `bun test` passes, and `bun run check` reports zero errors.
