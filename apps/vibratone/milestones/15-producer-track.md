# 15. Producer Track

## Outcome

A learner interested in audio production can open the Producer track, select a drill type (EQ-band identification, filter sweep, compression detection, reverb amount, delay time, stereo width, or distortion), complete a drill, receive scored feedback, and see their attempt recorded locally—all without auth, a database, or an external sample library. The AP track remains the primary landing-page story. The Producer track is clearly labeled as a prototype.

## Product Requirements

- Add a Producer track route at `/producer` with a drill-type selector and drill runner.
- Implement seven drill types, each following the pattern: audio stimulus generated from a Web Audio node graph, discrete answer choices, exact-match correctness scoring, and a `ProducerAttemptEvent` appended to localStorage on submission.
- **EQ-band identification (primary wedge drill)**: Broadband pink noise through a `BiquadFilterNode` with `type='peaking'`, `gain=+12 dB`, `Q=1.0`. Center frequency drawn uniformly without replacement from the 8 trainable bands (63 Hz, 125 Hz, 250 Hz, 500 Hz, 1 kHz, 2 kHz, 4 kHz, 8 kHz) until all 8 have appeared; then reshuffle. Answer surface: 8 labeled frequency-band buttons. Correctness: exact band match.
- **Filter sweep**: Pink noise through a `BiquadFilterNode` with `type='lowpass'`, cutoff sweeping 200 Hz → 2 kHz over 2 seconds. Answer surface: 3 buttons (low / mid / high). Correctness: exact choice match.
- **Compression detection**: Dry signal and the same signal through a `DynamicsCompressorNode` (`threshold=-24 dB`, `ratio=8`). Answer surface: 2 buttons (dry / compressed). Correctness: exact choice match.
- **Reverb amount**: A sine-tone oscillator through a `ConvolverNode` with programmatically generated decaying-noise impulse responses of 0.5 s, 1.5 s, or 3 s. Answer surface: 3 buttons (short / medium / long). Correctness: exact choice match.
- **Delay time**: A single note followed by one echo from a `DelayNode`. Delay times: 125 ms, 250 ms, or 500 ms. Answer surface: 3 buttons (125 ms / 250 ms / 500 ms). Correctness: exact match.
- **Stereo width**: Mono signal versus widened signal (`StereoPannerNode` + channel splitter/merger). Answer surface: 3 buttons (mono / narrow stereo / wide stereo). Correctness: exact choice match.
- **Distortion**: Clean sine tone versus the same tone through a `WaveShaperNode` soft-clip curve. Answer surface: 2 buttons (clean / distorted). Correctness: exact choice match.
- Extend `src/lib/audio.ts` (`Synth` class) with factory methods for each new node type: `createBiquadFilter`, `createCompressor`, `createReverb`, `createDelay`, `createStereoPanner`, `createDistortion`. The `ConvolverNode` impulse response is generated programmatically as decaying white noise—no audio file asset required.
- Append a `ProducerAttemptEvent` to localStorage under `vibratone:producer-attempts:v1` on each submitted answer. No network calls.
- No auth, database, billing, or external sample library. All stimuli are pure Web Audio synthesis.
- The AP track at `/` is unchanged. No feature added by M15 moves or displaces the root AP trainer.

## User Experience Requirements

- The `/producer` route or its app-header navigation entry must display the text "Prototype" (or "Producer (Prototype)") as a visible marker. The navigation link appears after the AP link in DOM order.
- Each drill renders `stimulusDescription`—a human-readable text description of the stimulus—visibly in the DOM before any audio plays. The text alternative is the primary accessible deliverable; any canvas or waveform visualization is progressive enhancement.
- The drill runner presents: a text description of the stimulus, a play/replay button, answer-choice buttons, and correctness feedback after submission. Answer buttons are disabled once an answer is submitted.
- Correctness feedback communicates outcome as text, not color alone.
- The drill-type selector lets the learner choose among the seven drill types before starting.
- Responsive: the drill card and drill-type selector are usable at 375 px, 768 px, and 1280 px widths with no horizontal overflow and all controls visible.

## Data and Analytics Requirements

- On each submitted answer, append a `ProducerAttemptEvent` to `vibratone:producer-attempts:v1`. Required fields: `promptId`, `sessionId`, `timestamp`, `responseTimeMs`, `drillType`, `correctParameter`, `submittedAnswer`, `correct`.
- Producer analytics must be separable from AP, Relative Pitch, and Theory analytics at the event level. `ProducerAttemptEvent` must not be assignable to `AttemptEvent` (enforced by the TypeScript compiler).
- `appendProducerAttempt` never writes to `vibratone:attempts:v1` or any other existing log key.
- No attempt event is written for replaying audio or browsing drill types—only an explicit `submitAnswer()` call triggers a write.
- The localStorage key `vibratone:producer-attempts:v1` is the stable contract. M19's `buildReadersFromLocalStorage()` will read it; the shape must not change without a version bump.

## Accessibility Requirements

- Every answer-choice button is keyboard-operable: reachable via Tab, activatable via Enter or Space.
- The play/replay audio control has an explicit `aria-label` (`"Play stimulus"` / `"Replay stimulus"`).
- Correctness feedback after submission is announced via `aria-live="assertive"` on a feedback region.
- `stimulusDescription` is visible as text in the DOM before any audio plays (not only as an `aria-label` on a canvas).
- No unlabeled interactive elements. An axe-core scan on `/producer` reports zero violations in landmark, heading, and interactive-element categories.
- Under `prefers-reduced-motion: reduce`, any canvas visualization suppresses animation; the scheduler and audio continue normally.

## Module and Architecture Targets

### New files to create

**`src/lib/learning/drills/producer-drill.ts`**

```ts
export type ProducerDrillType =
	| 'eq-band'
	| 'filter-sweep'
	| 'compression-detection'
	| 'reverb-amount'
	| 'delay-time'
	| 'stereo-width'
	| 'distortion';

export type ProducerDrillConfig = {
	drillType: ProducerDrillType;
	/** The correct parameter value (e.g., '1kHz', 'compressed', 'short'). */
	correctParameter: string;
	/** Human-readable description of the stimulus for screen readers and visible text. */
	stimulusDescription: string;
	/** Available answer choices — at least 2, always includes correctParameter. */
	answerChoices: string[];
};

export type ProducerAttemptEvent = {
	promptId: string;
	sessionId: string;
	timestamp: number;
	responseTimeMs: number;
	drillType: ProducerDrillType;
	correctParameter: string;
	submittedAnswer: string;
	correct: boolean;
};

export const PRODUCER_ATTEMPTS_KEY = 'vibratone:producer-attempts:v1';

/** EQ-band pool — 8 entries, draw without replacement until exhausted, then reshuffle. */
export const EQ_BANDS = [
	'63Hz',
	'125Hz',
	'250Hz',
	'500Hz',
	'1kHz',
	'2kHz',
	'4kHz',
	'8kHz'
] as const;
export type EQBand = (typeof EQ_BANDS)[number];

/** Generate a drill config for the given type. For eq-band, pool state is managed externally. */
export function generateProducerPrompt(drillType: ProducerDrillType): ProducerDrillConfig;

/** Score a submitted answer: correct iff submittedAnswer === correctParameter. */
export function scoreProducerAnswer(correctParameter: string, submittedAnswer: string): boolean;
```

**`src/lib/learning/analytics/producer-log.ts`**

```ts
import type { ProducerAttemptEvent } from '$lib/learning/drills/producer-drill';

/** Append one attempt event to vibratone:producer-attempts:v1. Zero network calls. */
export function appendProducerAttempt(event: ProducerAttemptEvent): void;

/** Load all recorded events in insertion order. Returns [] when key is absent or malformed. */
export function loadProducerAttempts(): ProducerAttemptEvent[];
```

**`src/lib/audio/producer-nodes.ts`** — factory functions for Producer drill Web Audio sub-graphs:

```ts
export function createEQNode(ctx: AudioContext, centerFrequency: number): BiquadFilterNode;
export function createFilterSweepNode(ctx: AudioContext): BiquadFilterNode;
export function createCompressorNode(ctx: AudioContext): DynamicsCompressorNode;
/** Generates impulse response as decaying white noise — no audio file. */
export function createReverbNode(ctx: AudioContext, decaySeconds: number): ConvolverNode;
export function createDelayNode(ctx: AudioContext, delaySeconds: number): DelayNode;
export function createWaveShaperNode(ctx: AudioContext): WaveShaperNode;
export function createStereoWidthGraph(
	ctx: AudioContext,
	width: 'mono' | 'narrow' | 'wide'
): AudioNode;
```

**`src/lib/state/producer.svelte.ts`** — factory + context following the `createPracticeState()` convention:

```ts
import { createContext } from 'svelte';
import type { ProducerDrillConfig } from '$lib/learning/drills/producer-drill';

export type ProducerPhase = 'idle' | 'playing' | 'answered';

export type ProducerState = ReturnType<typeof createProducerState>;

const [getProducerState, setProducerState] = createContext<ProducerState>();
export { getProducerState, setProducerState };

export function createProducerState() {
	let phase = $state<ProducerPhase>('idle');
	let currentConfig = $state<ProducerDrillConfig | null>(null);
	let correct = $state<boolean | null>(null);
	let audioError = $state<string | null>(null);
	// AudioNodes are NOT constructed here — wired by the page component inside onMount.

	return {
		get phase() {
			return phase;
		},
		get currentConfig() {
			return currentConfig;
		},
		get correct() {
			return correct;
		},
		get audioError() {
			return audioError;
		},
		loadDrill, // (config: ProducerDrillConfig) => void
		play, // () => void — advances phase to 'playing'
		replay, // () => void — re-sounds without changing phase or result
		submitAnswer, // (submitted: string) => void — only valid in 'playing' phase
		destroy // () => void — disconnects AudioNodes, clears timers
	};
}
```

**`src/lib/components/producer-drill-card.svelte`** — renders `stimulusDescription` (text always present), answer-choice buttons, feedback region, play/replay control.

**`src/lib/components/producer-drill-card.svelte.test.ts`** — component test file.

**`src/lib/stubs/cinder-signal-viz.ts`** — Cinder #324 stub:

```ts
export type SignalSnapshot = {
	type: 'eq' | 'compression' | 'reverb' | 'delay' | 'width' | 'distortion';
	value: number;
	unit: string;
};

// STUB: replace with @lostgradient/cinder SignalVisualizer when Cinder #324 ships.
// The stub renders an accessible text alternative; the real component adds a visual layer.
export { default as SignalVisualizer } from './signal-visualizer-stub.svelte';
```

**`src/routes/producer/+layout.svelte`** — creates `ProducerState` via context; calls `onDestroy(() => state.destroy())`.

**`src/routes/producer/+page.svelte`** — Producer track hub: "Prototype" label, drill-type selector, drill runner using `producer-drill-card.svelte`. Constructs audio nodes in `onMount`.

**`src/routes/producer/+page.ts`** — universal load returning `{}`. Confirms no SSR access to Web Audio.

### Modified files

- **`src/lib/audio.ts`** — add six methods to the `Synth` class (following M16's `scheduleNote` / `playChord` precedent). All construction occurs inside the returned call, never at module init:
  - `createBiquadFilter(type: BiquadFilterType, frequency: number, Q: number): BiquadFilterNode`
  - `createCompressor(options?: DynamicsCompressorOptions): DynamicsCompressorNode`
  - `createReverb(decaySecs: number): ConvolverNode` — IR generated as decaying white noise, clamped 0.1–10 s
  - `createDelay(delayTime: number): DelayNode`
  - `createStereoPanner(pan: number): StereoPannerNode`
  - `createDistortion(amount: number): WaveShaperNode` — sigmoid curve, `amount` 0–100
- **`src/lib/components/app-header.svelte`** — add navigation link to `/producer` labeled "Producer (Prototype)", after the AP link in DOM order.

### Test files

- `src/lib/learning/drills/producer-drill.spec.ts`
- `src/lib/learning/analytics/producer-log.spec.ts`
- `src/lib/audio/producer-nodes.spec.ts`
- `src/lib/components/producer-drill-card.svelte.test.ts`
- `e2e/producer.e2e.ts`

### SSR safety invariant

Every file introduced by M15 must contain no references to `window`, `document`, `localStorage`, `navigator`, `AudioContext`, or `requestAnimationFrame` at module initialization time. All Web Audio API construction must occur inside `onMount` or `$effect` bodies in page components—never in factory function bodies or at module scope. The `getSynth()` guard pattern from `src/lib/audio.ts` is the established model.

### Svelte 5 style note

New components use the Svelte 5 class array/object syntax exclusively:

```svelte
<button class={['choice-btn', selected && 'choice-btn--selected']}>
```

Do not introduce `class:name={condition}` directives in new code.

## Dependencies

- **M01 (AP Trainer MVP)** — provides the `AudioContext.currentTime`-based lookahead scheduler and the established `Synth` class in `src/lib/audio.ts` that M15 extends with Producer-specific node factory methods.
- **M10 (Answer Surfaces, MIDI, and Accessibility)** — provides reusable answer-surface patterns (choice button grids, keyboard-shortcut conventions, focus-ring and `aria-live` patterns) and the accessibility infrastructure that Producer drill answer surfaces follow.

The existing `AttemptEvent` type, `seeded-random`, and localStorage append pattern from M00 are established codebase conventions that M15 follows—not listed as a direct dependency since M01 and M10 already carry them transitively.

## External Dependency Contracts

| Capability                                 | Owner / Ticket                                                    | Contract needed                                                                                                                              | Stub / mock plan                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signal visualization component             | Cinder [#324](https://github.com/stevekinney/cinder/issues/324)   | A Svelte 5 component accepting `{ signal: SignalSnapshot; label: string }` that renders a visual representation of the audio parameter value | `src/lib/stubs/cinder-signal-viz.ts` — stub renders `<output aria-live="polite">{signal.value} {signal.unit} — {label}</output>`. The accessible text readout is the primary a11y deliverable; the visual layer from #324 is progressive enhancement. No component changes needed when #324 ships—replace the import path only. |
| Octavian #32 — Web Audio rendering adapter | Octavian [#32](https://github.com/stevekinney/octavian/issues/32) | Not required for M15. Producer stimuli are pure Web Audio graphs; `Synth` extensions cover all node creation directly.                       | Resolved NO for M15.                                                                                                                                                                                                                                                                                                            |
| Octavian #30 — timed music events          | Octavian [#30](https://github.com/stevekinney/octavian/issues/30) | Not required. Producer stimuli are single-shot playback, not quantized event sequences.                                                      | Resolved NO for M15.                                                                                                                                                                                                                                                                                                            |
| Octavian #37 — timing / quantization       | Octavian [#37](https://github.com/stevekinney/octavian/issues/37) | Not required. Producer stimuli are single-shot.                                                                                              | Resolved NO for M15.                                                                                                                                                                                                                                                                                                            |
| Octavian #38 — Standard MIDI File export   | Octavian [#38](https://github.com/stevekinney/octavian/issues/38) | Not required for Producer drills.                                                                                                            | Resolved NO for M15.                                                                                                                                                                                                                                                                                                            |
| Octavian #22 — progression primitives      | Octavian [#22](https://github.com/stevekinney/octavian/issues/22) | Not required for Producer drills.                                                                                                            | Resolved NO for M15.                                                                                                                                                                                                                                                                                                            |

## Acceptance Criteria

Each criterion is a concrete binary pass/fail check.

**AC-15-01 — Producer route renders without error**: Navigating to `/producer` in a fresh browser session renders at least one drill-type selector without a JavaScript console error. Verified by `e2e/producer.e2e.ts` → `user can navigate to /producer`.

**AC-15-02 — EQ-band correctParameter is within the 8 named bands**: `generateProducerPrompt('eq-band')` returns a `ProducerDrillConfig` whose `correctParameter` is one of the 8 named frequency bands (`63Hz`, `125Hz`, `250Hz`, `500Hz`, `1kHz`, `2kHz`, `4kHz`, `8kHz`). Verified by `producer-drill.spec.ts` → `generateProducerPrompt eq-band correctParameter is within the 8 named bands`.

**AC-15-03 — All seven drill types generate valid configs**: `generateProducerPrompt(type)` returns a non-null `ProducerDrillConfig` with `answerChoices.length >= 2` and `answerChoices` including `correctParameter` for every value in `ProducerDrillType`. Verified by `producer-drill.spec.ts` → `generateProducerPrompt returns valid config for every ProducerDrillType`.

**AC-15-04 — Correct answer scores true, wrong answer scores false**: `scoreProducerAnswer(correct, correct)` returns `true`; `scoreProducerAnswer(correct, anyOther)` returns `false`. Verified by `producer-drill.spec.ts` → `scoreProducerAnswer correct submission is true` and `scoreProducerAnswer wrong submission is false`.

**AC-15-05 — EQ-band pool draws without replacement**: Over 8 consecutive calls to `generateProducerPrompt('eq-band')` with session pool state, all 8 bands appear exactly once before any repeats. Verified by `producer-drill.spec.ts` → `generateProducerPrompt eq-band pool exhausts all 8 bands before repeating`.

**AC-15-06 — Attempt event persists all required fields**: Submitting one EQ-band answer writes a `ProducerAttemptEvent` to `vibratone:producer-attempts:v1` containing all required fields: `promptId`, `sessionId`, `timestamp`, `responseTimeMs`, `drillType`, `correctParameter`, `submittedAnswer`, `correct`. Verified by `producer-log.spec.ts` → `appendProducerAttempt persists all required fields`.

**AC-15-07 — Producer log does not write to AP log**: `appendProducerAttempt` writes only to `vibratone:producer-attempts:v1` and never writes to `vibratone:attempts:v1`. Verified by `producer-log.spec.ts` → `appendProducerAttempt does not write to vibratone:attempts:v1`.

**AC-15-08 — ProducerAttemptEvent is not assignable to AttemptEvent**: The TypeScript compiler rejects any assignment of `ProducerAttemptEvent` to `AttemptEvent`. Verified by `bun run check` passing without type errors plus a compile-time assertion in `producer-drill.spec.ts` → `ProducerAttemptEvent is not assignable to AttemptEvent (type-level gate)`.

**AC-15-09 — stimulusDescription is visible before audio plays**: Every rendered `producer-drill-card` has a non-empty `stimulusDescription` visible as text in the DOM before any audio plays. Verified by `producer-drill-card.svelte.test.ts` → `renders stimulusDescription as visible text before audio plays`.

**AC-15-10 — Answer choices are keyboard-operable**: All answer-choice buttons are reachable via Tab and activatable via Enter or Space. Verified by `e2e/producer.e2e.ts` → `keyboard-only: user completes one EQ-band drill with Tab and Enter only`.

**AC-15-11 — Web Audio nodes are M15 additions**: The `Synth` class gains `createBiquadFilter`, `createCompressor`, `createReverb`, `createDelay`, `createStereoPanner`, and `createDistortion` methods by M15. A code review confirms these are additions (not pre-existing), and `audio.spec.ts` named tests assert each method returns the expected node type. Verified by `audio.spec.ts` additions + code review.

**AC-15-12 — Reverb uses programmatic IR, no audio file**: `createReverb(decaySecs)` returns a `ConvolverNode` whose buffer is generated as decaying white noise at runtime. No `.wav`/`.mp3`/`.ogg` asset is loaded. Verified by `src/lib/audio/producer-nodes.spec.ts` → `createReverbNode returns ConvolverNode with non-null buffer and no fetch call`.

**AC-15-13 — AP landing page is unchanged**: Navigating to `/` renders the AP trainer as the primary content with no Producer track components in the primary slot. Verified by `e2e/producer.e2e.ts` → `AP trainer remains at root route after Producer track ships`.

**AC-15-14 — Producer track has a visible Prototype label**: The `/producer` route includes the word "Prototype" as visible text present in the accessible text tree. Verified by `e2e/producer.e2e.ts` → `Producer track is labeled as Prototype`.

**AC-15-15 — No auth or database imports**: No file introduced by M15 imports a database client or auth session handler. Verified by:

```
grep -r 'from.*\$lib/db\|from.*\$lib/auth' \
  src/routes/producer \
  src/lib/learning/drills/producer-drill.ts \
  src/lib/learning/analytics/producer-log.ts \
  src/lib/audio/producer-nodes.ts
```

returning no results.

**AC-15-16 — Responsive layout**: The Producer drill card and drill-type selector produce no horizontal overflow and all controls remain visible at 375 px, 768 px, and 1280 px widths. Verified by `e2e/producer.e2e.ts` → responsive smoke at three viewport widths.

**AC-15-17 — No non-localhost network requests**: No file loaded during a Producer drill session makes a fetch or XHR call to a non-localhost host. Verified by `e2e/producer.e2e.ts` → `no non-localhost network requests during a Producer drill session`.

## Test Plan

### Unit tests — `src/lib/learning/drills/producer-drill.spec.ts`

- `generateProducerPrompt returns valid config for every ProducerDrillType`
- `generateProducerPrompt eq-band correctParameter is within the 8 named bands`
- `generateProducerPrompt eq-band pool exhausts all 8 bands before repeating`
- `generateProducerPrompt filter-sweep returns exactly 3 answer choices (low, mid, high)`
- `generateProducerPrompt compression-detection returns exactly 2 answer choices (dry, compressed)`
- `generateProducerPrompt distortion returns exactly 2 answer choices (clean, distorted)`
- `generateProducerPrompt answerChoices always includes correctParameter for every drill type`
- `generateProducerPrompt stimulusDescription is a non-empty string for every drill type`
- `scoreProducerAnswer correct submission is true`
- `scoreProducerAnswer wrong submission is false`
- `scoreProducerAnswer is case-sensitive (mismatched case scores false)`
- `ProducerAttemptEvent is not assignable to AttemptEvent (type-level gate)`

### Unit tests — `src/lib/learning/analytics/producer-log.spec.ts`

- `appendProducerAttempt persists all required fields to vibratone:producer-attempts:v1`
- `appendProducerAttempt does not write to vibratone:attempts:v1`
- `loadProducerAttempts returns empty array when key is absent`
- `loadProducerAttempts returns empty array when localStorage value is malformed (no throw)`
- `loadProducerAttempts returns events in insertion order`
- `appendProducerAttempt makes zero fetch calls`

### Unit tests — `src/lib/audio/producer-nodes.spec.ts` (using `AudioContextStub` from `src/lib/testing/audio-context-stub.ts`)

- `createEQNode returns a BiquadFilterNode with type='peaking' and gain=12`
- `createEQNode sets frequency to the provided centerFrequency value`
- `createCompressorNode returns a DynamicsCompressorNode with threshold=-24 and ratio=8`
- `createReverbNode returns a ConvolverNode with a non-null buffer`
- `createReverbNode generates the buffer without any fetch call (no audio file loaded)`
- `createReverbNode clamps decaySeconds below 0.1 to 0.1`
- `createReverbNode clamps decaySeconds above 10 to 10`
- `createDelayNode returns a DelayNode with delayTime matching the input`
- `createWaveShaperNode returns a WaveShaperNode with a non-null curve`
- `createStereoWidthGraph returns an AudioNode for each of mono / narrow / wide`

### Unit tests — `src/lib/audio.spec.ts` additions

- `createBiquadFilter returns a BiquadFilterNode with the requested type and frequency`
- `createBiquadFilter does not call stopAll()`
- `createCompressor returns a DynamicsCompressorNode`
- `createReverb returns a ConvolverNode with a non-null buffer`
- `createDelay returns a DelayNode with delayTime matching the argument`
- `createStereoPanner returns a StereoPannerNode with pan set correctly`
- `createDistortion returns a WaveShaperNode with a non-null curve for amount > 0`
- `createDistortion returns a WaveShaperNode with a flat (no-clip) curve for amount = 0`

### Component tests (vitest-browser-svelte) — `src/lib/components/producer-drill-card.svelte.test.ts`

- `renders stimulusDescription as visible text before audio plays`
- `renders one button per answer choice`
- `answer buttons have role=button and are keyboard-activatable (Enter and Space)`
- `selecting an answer disables further answer-choice buttons`
- `correct feedback is announced via aria-live="assertive"`
- `incorrect feedback is announced via aria-live="assertive"`
- `feedback communicates correctness as text, not color alone`
- `play button has aria-label "Play stimulus"`
- `replay button has aria-label "Replay stimulus"`
- `axe-core scan on rendered card reports zero violations`

### Playwright e2e specs — `e2e/producer.e2e.ts`

(Note: `playwright.config.ts` uses `testMatch: '**/*.e2e.{ts,js}'`—all Producer e2e specs use the `.e2e.ts` suffix.)

- `user can navigate to /producer`
- `user can select a drill type and see a stimulus description`
- `user can click play and hear audio with no console errors`
- `user can submit an answer and see feedback`
- `keyboard-only: user completes one EQ-band drill with Tab and Enter only`
- `AP trainer remains at root route after Producer track ships`
- `Producer track is labeled as Prototype`
- `no non-localhost network requests during a Producer drill session`
- `responsive: no horizontal overflow at 375 × 812`
- `responsive: all controls visible at 768 × 1024`
- `responsive: all controls visible at 1280 × 800`
- `axe accessibility scan on /producer reports zero violations in landmark, heading, and interactive-element categories`

### Acceptance criterion → test mapping

| AC                                            | Named test(s)                                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| AC-15-01 — Producer route renders             | `e2e: user can navigate to /producer`                                                                                              |
| AC-15-02 — EQ-band within 8 named bands       | `producer-drill.spec: eq-band correctParameter is within the 8 named bands`                                                        |
| AC-15-03 — All 7 types generate valid configs | `producer-drill.spec: generateProducerPrompt returns valid config for every ProducerDrillType`                                     |
| AC-15-04 — Correct/wrong scoring              | `producer-drill.spec: scoreProducerAnswer correct submission is true / wrong is false`                                             |
| AC-15-05 — EQ pool without-replacement        | `producer-drill.spec: eq-band pool exhausts all 8 bands before repeating`                                                          |
| AC-15-06 — Attempt persists all fields        | `producer-log.spec: appendProducerAttempt persists all required fields`                                                            |
| AC-15-07 — No write to AP log                 | `producer-log.spec: appendProducerAttempt does not write to vibratone:attempts:v1`                                                 |
| AC-15-08 — Type-level separation              | `producer-drill.spec: ProducerAttemptEvent is not assignable to AttemptEvent` + `bun run check`                                    |
| AC-15-09 — stimulusDescription in DOM         | `producer-drill-card.svelte.test: renders stimulusDescription as visible text before audio plays`                                  |
| AC-15-10 — Keyboard-operable                  | `e2e: keyboard-only: user completes one EQ-band drill with Tab and Enter only`                                                     |
| AC-15-11 — New Synth methods                  | `audio.spec additions: createBiquadFilter / createCompressor / createReverb / createDelay / createStereoPanner / createDistortion` |
| AC-15-12 — Programmatic IR                    | `producer-nodes.spec: createReverbNode generates buffer without fetch call`                                                        |
| AC-15-13 — AP route unchanged                 | `e2e: AP trainer remains at root route after Producer track ships`                                                                 |
| AC-15-14 — Prototype label                    | `e2e: Producer track is labeled as Prototype`                                                                                      |
| AC-15-15 — No auth/db imports                 | `grep` gate (see AC text)                                                                                                          |
| AC-15-16 — Responsive                         | `e2e: responsive at 375 / 768 / 1280`                                                                                              |
| AC-15-17 — No network requests                | `e2e: no non-localhost network requests during a Producer drill session`                                                           |

## Verification

Run the standard gate:

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

**Grep gates (required before sign-off)**:

```bash
# No database or auth imports in Producer track files
grep -r 'from.*\$lib/db\|from.*\$lib/auth' \
  src/routes/producer \
  src/lib/learning/drills/producer-drill.ts \
  src/lib/learning/analytics/producer-log.ts \
  src/lib/audio/producer-nodes.ts
# Must return no results.

# No AP-claims violations
grep -rE 'perfect pitch|guaranteed|will learn' src/
# Must return no results.
```

**Manual smoke tests (required before sign-off)**:

- Chrome, Safari, Firefox: play each of the seven drill types. Confirm audio output and no console errors in each browser.
- Chrome, Safari: `DynamicsCompressorNode` and `ConvolverNode`—confirm no `NotSupportedError` in the console.
- VoiceOver (macOS Safari): navigate `/producer` without a mouse. Confirm drill type selector, stimulus description, answer buttons, and feedback are all announced correctly.
- NVDA (Windows Chrome): same path as VoiceOver.
- Mobile Chrome at 375 px: confirm answer surface does not overflow and all controls are tappable.

## Non-Goals

- Do not build the step sequencer or chord progression lab. Those are M16.
- Do not build the unified Today surface or any cross-track recommendation logic. That is M19.
- Do not add launch documentation pages. That is M19.
- Do not make the Producer track the primary landing-page story. AP stays at `/`.
- Do not turn Producer drills into a full DAW, VST plugin, or effects rack.
- Do not require an external sample library. All Producer stimuli use Web Audio synthesis only.
- Do not add continuous numeric sliders or tolerance-band scoring to this milestone. All answers are discrete labeled choices; tolerance scoring is a future enhancement if the prototype validates.
- Do not add Standard MIDI File export. Octavian #38—resolved NO for M15.
- Do not add timing/quantization helpers. Octavian #37—resolved NO for M15.
- Do not add Octavian progression primitives or timed-event sequences. Octavian #22 and #30—resolved NO for M15.
- Do not add FSRS scheduling for Producer drills. The prototype records attempts only; FSRS integration is a post-validation enhancement.
- Do not implement the `TrackAnalyticsReader` interface from M19 in this milestone. M15 ships the write side (`producer-log.ts`); M19 builds the reader over that log.
- Do not add auth, billing, cloud sync, or a database.
- Do not publish aggregate efficacy reports. That belongs to M21.
- Do not add native mobile applications.

## Completion Signal

This milestone is complete when: all named unit tests in `producer-drill.spec.ts`, `producer-log.spec.ts`, and `producer-nodes.spec.ts` pass; all named component tests in `producer-drill-card.svelte.test.ts` pass; all named Playwright specs in `e2e/producer.e2e.ts` pass at all three viewport sizes; and `bun run check`, `bun run lint`, `bun run test:unit -- --run`, and `bun run test:e2e` are green with no skipped or deferred tests.

**Success metric**: A returning learner can navigate to `/producer`, select EQ-band identification, complete 5 consecutive drills, and see scored feedback for each—measured by a Playwright walkthrough from page navigation to fifth feedback screen completing in under 2 minutes with no unhandled errors.

**Kill criterion**: If fewer than 10% of active users (users who have completed at least one AP or Relative Pitch drill in the prior 30 days) open the Producer track within 60 days of M15 shipping, treat the prototype as unvalidated. Freeze further Producer track feature investment until the hypothesis is revisited with a product decision. Do not allow Producer track debt to delay M16, M19, or M20.
