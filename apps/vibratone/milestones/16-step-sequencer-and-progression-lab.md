# 16. Step Sequencer and Chord Progression Lab

## Outcome

A learner in the Producer or Theory track can build and hear a looping step pattern and a diatonic chord progression through the shared lookahead audio scheduler, validating that the engine supports creative free-play tools without requiring a DAW or recording workflow. Both surfaces reinforce learned theory through play and never generate learning evidence.

## Product Requirements

- Add a single-voice, 16-step on/off sequencer. Each active step plays the note assigned to that step. Step count is fixed at 16; there is no multitrack, polyphonic-row, or pattern-expansion UI.
- Per-step note selection covers one octave of the chromatic scale (C3–B3 by default, configurable via an octave picker).
- Tempo range: 60–180 BPM, adjustable via a slider or numeric input. Values outside this range are clamped without error.
- Transport controls: play, stop, loop (loop is on by default).
- Audio source: the existing oscillator from the current audio engine. When a sample bank is available in the browser (loaded independently via milestone 02), the sequencer can use sampled notes instead. The UI offers both options when samples are available; it falls back silently to the oscillator when they are not.
- The step sequencer uses the `AudioContext.currentTime`-based lookahead scheduler from milestone 01. `setInterval` drives only the JS poll; note onsets are always scheduled via `AudioContext.currentTime` offsets. There is no audio recording, waveform capture, or audio file export of any kind.
- No per-step velocity, no swing, no multi-voice, no pattern save/load in this milestone.
- Add a chord progression lab. The learner selects a key (any of the 12 major keys), a tempo (60–180 BPM), and a sequence of up to 8 chords.
- The chord picker draws root and quality from Octavian in the selected key. Supported qualities: major, minor, dominant 7th, major 7th, minor 7th. No diminished, augmented, or extended chords in this milestone. Chord symbol to note frequencies uses `new Chord(root, qualitySuffix).notes.map(n => n.frequency)` from the `octavian@3.0.0` root export (already available; no stub required for this step). Quality suffix strings must be Octavian-format identifiers—`'major'`, `'m'`, `'7'`, `'maj7'`, `'m7'`—not prose labels.
- Chord playback is blocked (all chord notes simultaneously), scheduled through the milestone 01 lookahead scheduler.
- Each chord slot has a configurable duration: 1 or 2 bars. Beat subdivisions are not exposed.
- Chord progression transport controls: play, stop, loop.
- No free-form Roman numeral text input, no chord import, no notation rendering, no mixer, no per-step FX chain, no signal visualizer.
- Neither surface generates attempt events, updates FSRS state, or appears in learning-progress summaries.
- Tempo changes applied while running take effect on the next loop iteration, not mid-phrase. This applies to both the step sequencer and the chord progression lab.
- Session usage is not logged in this milestone. No `FreePlayEvent` type is introduced. The `vibratone:attempts:v1` key is not touched. Free-play analytics are explicitly deferred to a future milestone.

## User Experience Requirements

- AP remains the primary landing-page story. Both tools are presented as free-play creative surfaces, clearly distinct from scored drills. Neither tool is described as improving absolute pitch or any measurable hearing skill.
- The step sequencer grid is navigable at 375 px (phone), 768 px (tablet), and 1280 px (desktop) widths. No horizontal overflow at any breakpoint.
- The chord progression lab chord picker, tempo input, key selector, and transport controls are all reachable and operable by keyboard alone.
- Step highlight changes update visually at BPM without causing VoiceOver to announce every individual step change. The `aria-live` region announces bar numbers (every 4 steps), not individual step changes.
- Under `prefers-reduced-motion: reduce`, step highlights change via CSS `outline` rather than animated fill or `transform`. The scheduler continues running; only the visual transition is suppressed.
- Tempo changes applied while the sequencer is stopped take effect on the next play. Tempo changes applied while running take effect on the next loop iteration, not mid-phrase.
- Visual step highlight is synchronized to the audible beat, not to the scheduling callback. The active step indicator advances when `AudioContext.currentTime` reaches the scheduled onset time, not when the note is enqueued.

## Data and Analytics Requirements

- Step sequencer and chord progression lab sessions never emit `AttemptEvent` records and never call any FSRS update function.
- Session usage is not logged in this milestone. No free-play event type is defined here. The `vibratone:attempts:v1` localStorage key is not touched. If product analytics for free-play sessions are added in a future milestone, the type and storage key will be defined then.
- The free-play vs. learning-evidence boundary is enforced at the TypeScript type level: neither surface exports or emits any shape that satisfies the `AttemptEvent` contract.
- The free-play isolation boundary is additionally enforced at the ESLint level via a `no-restricted-imports` rule that prevents any sequencer or progression file from importing the attempt log, FSRS scheduling, or FSRS library modules.

## Accessibility Requirements

- Every step toggle in the sequencer grid is keyboard-operable: Tab to reach, Space or Enter to toggle.
- Each step button is a native `<button>` element with `aria-pressed={step.active}` and a stable `aria-label` of the form `"Step N, [on|off], [note name]"` that updates when the step state or octave changes. Do not add `role="button"` explicitly—it is redundant on native `<button>` and triggers the Svelte `a11y_no_redundant_roles` compiler warning.
- Transport controls (`play`, `stop`) expose `aria-label` values that alternate between `"Start sequencer"` / `"Stop sequencer"` and `"Start progression"` / `"Stop progression"` as appropriate.
- BPM input: `<input type="number" min="60" max="180" step="5" aria-label="Beats per minute">`.
- A single `aria-live="polite"` region announces the current bar number (every 4 steps). This prevents VoiceOver from flooding the user with individual step announcements at high BPM.
- The chord picker, key selector, tempo input, and progression transport controls are all screen-reader-announced with no unlabeled interactive elements.

## Module and Architecture Targets

### New files to create

**Learning domain:**

- `src/lib/learning/drills/sequencer-drill.ts` — exports `SequencerStep`, `SequencerPattern`, `SequencerPlaybackState`, `buildPattern()`, `toggleStep()`. No velocity field; no swing field.
- `src/lib/learning/drills/progression-drill.ts` — exports `ChordEvent`, `ProgressionPattern`, `ProgressionDrillConfig`, `buildProgression()`, `scheduleProgression()`, `cancelProgression()`.

**State:**

- `src/lib/state/sequencer.svelte.ts` — `createSequencerState()` factory and `[getSequencerState, setSequencerState]` context pair, following the same factory + `createContext` pattern as `src/lib/state.svelte.ts`. Must expose `destroy()` for `onDestroy` cleanup.
- `src/lib/state/progression.svelte.ts` — `createProgressionState()` factory and context pair. Owns chord queue, playback cursor, key, BPM, and loop flag. Must expose `destroy()`.

**Stubs (replaced when upstream issues ship):**

- `src/lib/stubs/octavian-sequences.ts` — stub implementing `computeTimedEvents(events: ChordEvent[], bpm: number, startTime: number): Array<{ frequencies: number[]; atTime: number; durationSeconds: number }>`. Computes `startTime + (cumulativeBars * (60 / bpm) * 4)` per chord, where `cumulativeBars` is the sum of `durationBars` for all preceding chords. All exports marked `// STUB: replace with octavian/sequences when #30 merges`. Adapter boundary documented in the file: `// ADAPTER BOUNDARY: when Octavian #30 ships, convert its sequence type here rather than changing call sites.`
- `src/lib/stubs/octavian-chords-in-key.ts` — stub implementing `chordsInKey(key: string, qualities: Quality[]): Array<{ root: string; quality: string; symbol: string }>` for the 12 major keys and 5 supported qualities. Quality strings must use Octavian suffix identifiers (`'major'`, `'m'`, `'7'`, `'maj7'`, `'m7'`), not prose labels. Marked `// STUB: replace with octavian #22 when merged`.

**Audio extension:**

- Extend `src/lib/audio.ts` with `Synth.scheduleNote(frequency: number, options: PlayOptions, atTime: number): void` — accepts an absolute `AudioContext.currentTime` offset instead of playing immediately. Does not call `stopAll()` before scheduling. Calls `this.#registerVoice(gain, sources)` so all lookahead-scheduled sources are tracked in `Synth.#voices` and can be cancelled by `stopAll()`.
- Extend `src/lib/audio.ts` with `Synth.playChord(frequencies: number[], options: PlayOptions, atTime: number): void` — schedules all chord voices simultaneously without calling `stopAll()` before starting them. Also calls `this.#registerVoice()` for each voice.

**Test doubles (not production code):**

- `src/lib/testing/lookahead-scheduler-stub.ts` — exports `createStubScheduler(): LookaheadScheduler` that fires callbacks immediately with `currentTime: 0`. Used in unit tests only; never imported from production `src/lib/` code. The `LookaheadScheduler` interface is imported from milestone 01's export path (`$lib/audio/lookahead-scheduler.ts`), not redefined here.
- `src/lib/testing/audio-context-stub.ts` — `AudioContextStub` exposing `createGain()`, `createOscillator()`, `createBiquadFilter()`, `currentTime` (mutable, advanced by tests directly), `destination`, `clearScheduledEvents()`, and `scheduledEvents: Array<{ frequency: number; atTime: number; duration?: number }>`. The `createOscillator()` stub pushes `{ frequency: oscillator.frequency.value, atTime: when }` into `scheduledEvents` on each `start(when)` call.

**Type-level boundary tests:**

- `src/lib/learning/drills/sequencer-drill.test-d.ts` — uses `@ts-expect-error` to assert `SequencerPattern` and `SequencerStep` are not assignable to `AttemptEvent`. Verified by `bun run check`.
- `src/lib/learning/drills/progression-drill.test-d.ts` — uses `@ts-expect-error` to assert `ProgressionPattern`, `ChordEvent`, and `ProgressionDrillConfig` are not assignable to `AttemptEvent`. Verified by `bun run check`.

**Components:**

- `src/lib/components/step-sequencer.svelte` — 16-step grid, per-step note picker, octave picker, BPM slider, transport. Uses `SequencerState` from context via `getSequencerState()`.
- `src/lib/components/step-sequencer.test-harness.svelte` — wraps `<StepSequencer>` with `setSequencerState(createSequencerState())` and `onDestroy(() => state.destroy())`. Required for component test mounting; the component tests import this, not the component directly.
- `src/lib/components/chord-progression-lab.svelte` — key selector, up-to-8-chord builder, BPM input, transport, chord display. Uses `ProgressionState` from context via `getProgressionState()`.
- `src/lib/components/chord-progression-lab.test-harness.svelte` — same pattern for `ProgressionState`.

**Test files:**

- `src/lib/components/step-sequencer.svelte.test.ts`
- `src/lib/components/chord-progression-lab.svelte.test.ts`

**Routes:**

- `src/routes/sequencer/+page.svelte` — creates `SequencerState` via `setSequencerState(createSequencerState())`, calls `onDestroy(() => state.destroy())`. No `+page.ts` or `+page.server.ts` load function needed—both surfaces are fully client-side.
- `src/routes/progression/+page.svelte` — creates `ProgressionState` via `setProgressionState(createProgressionState())`, calls `onDestroy(() => state.destroy())`.

**Spec files:**

- `src/lib/learning/drills/sequencer-drill.spec.ts`
- `src/lib/learning/drills/progression-drill.spec.ts`
- `src/lib/audio.spec.ts` — additions only (existing file)
- `e2e/sequencer.spec.ts`
- `e2e/progression-lab.spec.ts`

### Modified files

- `src/lib/audio.ts` — add `scheduleNote()` and `playChord()` to the existing `Synth` class; add `#registerVoice()` calls in both new methods.
- `src/lib/components/app-header.svelte` — add navigation links to `/sequencer` and `/progression`.
- ESLint configuration — add `no-restricted-imports` rule (see ESLint Architecture Guard below).

### TypeScript contracts

```ts
// src/lib/learning/drills/sequencer-drill.ts

import type { PitchClass } from '$lib/music.ts';

export type SequencerStep = {
	pitchClass: PitchClass;
	octave: number;
	active: boolean;
};

export type SequencerPattern = {
	steps: SequencerStep[]; // length is always 16
	bpm: number; // 60–180, clamped
};

export type SequencerPlaybackState = {
	phase: 'stopped' | 'playing';
	currentStep: number; // 0–15
};
```

```ts
// src/lib/learning/drills/progression-drill.ts

export type ChordEvent = {
	/** Chord symbol in Octavian format, e.g. 'Cmaj7', 'Am', 'G7' */
	symbol: string;
	/** Root note frequencies for all chord tones */
	frequencies: number[];
	durationBars: 1 | 2;
};

export type ProgressionPattern = {
	events: ChordEvent[]; // 1–8 items
	bpm: number; // 60–180, clamped
	key: string; // e.g. 'C', 'G', 'Bb'
};

export type ProgressionDrillConfig = {
	key: string;
	chordSymbols: string[];
	bpm: number;
	looping: boolean;
};
```

### State factory shape (sequencer)

```ts
// src/lib/state/sequencer.svelte.ts (shape only)

export function createSequencerState() {
	// $state.raw — replaced wholesale by toggleStep and setBpm.
	// Avoids deep Proxy overhead on the 16-step array on every toggle.
	let pattern = $state.raw<SequencerPattern>(defaultPattern()); // 16 steps, bpm 120

	let playback = $state<SequencerPlaybackState>({ phase: 'stopped', currentStep: 0 });

	// Plain let — not $state. Timer IDs are not reactive values.
	// Wrapping a timer ID in $state causes Svelte to proxy a number, wasting
	// proxy allocation on a non-reactive primitive. Mirrors the autoAdvanceTimer
	// invariant in src/lib/state.svelte.ts.
	let pollHandle: ReturnType<typeof setInterval> | undefined;

	// Pending-step queue for audio-visual sync.
	// scheduleNote() pushes { stepIndex, audioTime } here when it enqueues a note.
	// The 25 ms poll advances playback.currentStep only when ctx.currentTime >= entry.audioTime,
	// keeping the visual highlight synchronized with the ear, not the scheduling callback.
	let scheduledQueue: Array<{ stepIndex: number; audioTime: number }> = [];

	// start() acquires AudioContext inside the user gesture; must only be called from
	// onMount or an event handler. Never call start() at module initialization time.

	return {
		get pattern() {
			return pattern;
		},
		get playback() {
			return playback;
		},
		toggleStep, // (index: number) => void — throws RangeError if index < 0 or >= 16
		setBpm, // (bpm: number) => void — clamped to [60, 180]
		start, // () => void — resumes AudioContext inside user gesture
		stop, // () => void
		destroy // () => void — clears setInterval poll, calls synth.stopAll()
	};
}
```

### State factory shape (progression)

```ts
// src/lib/state/progression.svelte.ts (shape only)

export function createProgressionState() {
	// Plain let — not $state. Mirrors sequencer transport-timer invariant.
	let pollHandle: ReturnType<typeof setInterval> | undefined;

	let pattern = $state<ProgressionPattern>({ events: [], bpm: 120, key: 'C' });
	let playback = $state<{ phase: 'stopped' | 'playing'; currentChordIndex: number }>({
		phase: 'stopped',
		currentChordIndex: 0
	});

	return {
		get pattern() {
			return pattern;
		},
		get playback() {
			return playback;
		},
		setKey, // (key: string) => void
		addChord, // (symbol: string, durationBars: 1 | 2) => void — no-op if events.length >= 8
		removeChord, // (index: number) => void
		setBpm, // (bpm: number) => void — clamped to [60, 180]
		start, // () => void — resumes AudioContext inside user gesture
		stop, // () => void
		destroy // () => void — clears poll interval, calls synth.stopAll()
	};
}
```

### Transport-timer invariant (both state factories)

The `setInterval` handle in `createSequencerState` and the scheduling handle in `createProgressionState` are plain `let` variables—not `$state`. Timer IDs are not reactive values. Wrapping a timer ID in `$state` causes Svelte to proxy a number, which does not break visibly but wastes proxy allocation on a non-reactive primitive. This mirrors the `autoAdvanceTimer` invariant in `src/lib/state.svelte.ts`.

### Visual/audio clock synchronization (pending-step queue)

The lookahead scheduler fires JS callbacks ahead of the audio clock by a configurable window (typically 80–150 ms). Bumping `playback.currentStep` at the moment a note is _scheduled_ causes the visual highlight to lead the audible onset by that window.

The correct pattern inside the 25 ms poll callback:

```ts
const now = ctx.currentTime;
while (scheduledQueue.length > 0 && now >= scheduledQueue[0].audioTime) {
	playback.currentStep = scheduledQueue.shift()!.stepIndex;
}
```

`scheduleNote()` pushes `{ stepIndex, audioTime }` onto `scheduledQueue` at scheduling time. The poll advances `currentStep` only when `ctx.currentTime` has actually reached that onset. This keeps the highlight synchronized with the ear.

### ESLint architecture guard (free-play isolation boundary)

Add to the project ESLint configuration. This makes `bun run lint` fail automatically if the isolation boundary is violated, replacing any manual grep for AC-16-15 and AC-16-16:

```js
{
  files: [
    'src/routes/sequencer/**',
    'src/routes/progression/**',
    'src/lib/learning/drills/sequencer-drill.ts',
    'src/lib/learning/drills/progression-drill.ts',
    'src/lib/state/sequencer.svelte.ts',
    'src/lib/state/progression.svelte.ts',
  ],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['**/learning/drills/attempt-log*'], message: 'Free-play surfaces must not emit AttemptEvents.' },
        { group: ['**/learning/scheduling*'], message: 'Free-play surfaces must not call FSRS scheduling functions.' },
        { group: ['ts-fsrs', 'ts-fsrs/*'], message: 'Free-play surfaces must not import the FSRS library.' },
        { group: ['**/$lib/db*'], message: 'Free-play surfaces must not import a database client.' },
        { group: ['**/$lib/auth*'], message: 'Free-play surfaces must not import auth state.' },
      ],
    }],
  },
}
```

### Svelte 5 style notes

New components in this milestone use the Svelte 5 class array/object syntax exclusively:

```svelte
<button class={['step', step.active && 'step--active']}>
```

Do not introduce `class:name={condition}` directives in new code. Do not add `role="button"` to native `<button>` elements—it is redundant and triggers the Svelte `a11y_no_redundant_roles` compiler warning.

BPM inputs use Svelte 5.9 function bindings rather than manual `oninput` handlers:

```svelte
<input
	type="number"
	bind:value={() => state.bpm, (v) => state.setBpm(v)}
	min="60"
	max="180"
	step="5"
	aria-label="Beats per minute"
/>
```

### SSR safety

All `AudioContext` construction, `setInterval` transport ticks, and `AudioNode` wiring must be inside `onMount` or event handlers. The factory constructor body (`createSequencerState()`, `createProgressionState()`) performs zero browser-API access at call time—no `window`, `setInterval`, `AudioContext`, or `AudioNode` in the factory body. `start()` is the entry point for all audio setup. This mirrors the `createPracticeState()` pattern in `src/lib/state.svelte.ts`, which defers the `getSynth()` call to the `sound()` action.

## Dependencies

- **Milestone 01: Lookahead Audio Scheduler** — provides the `LookaheadScheduler` interface (exported from `src/lib/audio/lookahead-scheduler.ts`) and the `AudioContext.currentTime`-based lookahead transport that the step sequencer and chord progression lab require for drift-free scheduled playback. The `LookaheadScheduler` interface is imported from this milestone's export path; it is not redefined in milestone 16. The test double (`src/lib/testing/lookahead-scheduler-stub.ts`) is used in unit tests until the real scheduler is available.
- **Milestone 13: Theory Explorers and Natural-Language Drill Builder** — soft dependency only. The chord progression lab constructs chords using `new Chord(root, qualitySuffix)` from `octavian@3.0.0` directly (already available) and the `chordsInKey` stub from `src/lib/stubs/octavian-chords-in-key.ts`. Milestone 13's Octavian theory integration is a future upgrade point, not a hard prerequisite. Milestone 16 can ship without milestone 13 being complete.

**Soft dependency (progressive enhancement):**

- **Milestone 02: Sample-Loading Capability** — when milestone 02 has loaded a sample bank in the current browser session, the sequencer UI offers a source selector. The detection contract is `getSampleBank: () => SampledSynth | null` injected into both state factories (default: `() => null`). The oscillator path is always active and is the deterministic default in tests.

## External Dependency Contracts

| Capability                      | Owner / Ticket                                                                                      | Contract needed                                                                                                                                                                                                                             | Stub / mock plan                                                                                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LookaheadScheduler` interface  | **Milestone 01 (Lookahead Audio Scheduler)** — exported from `src/lib/audio/lookahead-scheduler.ts` | `interface LookaheadScheduler { scheduleAt(audioTime: number, cb: () => void): void; start(): void; stop(): void; readonly currentTime: number; readonly isRunning: boolean; }`                                                             | `src/lib/testing/lookahead-scheduler-stub.ts` — fires `cb()` immediately. Unit tests only; never imported from production `src/lib/` code.                                                                                                |
| Sample bank detection           | **Milestone 02 (Sample-Loading Capability)** — `SampledSynth` from `src/lib/sample-loader.ts`       | `getSampleBank: () => SampledSynth \| null` — injected into state factories; returns `null` until milestone 02 has loaded a bank in the current session                                                                                     | Default: `() => null`. Oscillator path is always active when null. Unit tests inject `() => null` by default; positive-path tests inject a mock `SampledSynth`.                                                                           |
| Chords in a key by quality      | Octavian [#22](https://github.com/stevekinney/octavian/issues/22)                                   | `chordsInKey(key: string, qualities: Quality[]): Array<{ root: string; quality: string; symbol: string }>` — where `quality` is an Octavian suffix string (`'major'`, `'m'`, `'7'`, `'maj7'`, `'m7'`)                                       | `src/lib/stubs/octavian-chords-in-key.ts` — hardcoded diatonic maps for all 12 major keys and the 5 supported qualities. Quality strings must be Octavian suffix identifiers, not prose. Drop-in when #22 ships.                          |
| Chord symbol → note frequencies | Octavian root export (already shipped, `octavian@3.0.0`)                                            | `new Chord(root, qualitySuffix).notes.map(n => n.frequency): number[]` — `Note.frequency` available without an octave argument; `.withOctave(n)` adjusts register                                                                           | No stub required. Import `Chord` from `'octavian'` directly. The `chordsInKey` stub must emit Octavian-format quality suffix strings, not prose labels, or `new Chord()` throws `TypeError: Unsupported chord suffix`.                    |
| Timed music event sequences     | Octavian [#30](https://github.com/stevekinney/octavian/issues/30)                                   | `computeTimedEvents(events: ChordEvent[], bpm: number, startTime: number): Array<{ frequencies: number[]; atTime: number; durationSeconds: number }>` — Vibratone-internal signature; adapter layer wraps the real #30 export when it ships | `src/lib/stubs/octavian-sequences.ts` — inline: `startTime + (cumulativeBars * (60 / bpm) * 4)` per chord. Marked `// STUB` and `// ADAPTER BOUNDARY`. When #30 ships, the adapter converts at this boundary without changing call sites. |
| Web Audio rendering adapter     | Octavian [#32](https://github.com/stevekinney/octavian/issues/32)                                   | Not required for this milestone. `Synth.scheduleNote()` and `Synth.playChord()` cover the need directly.                                                                                                                                    | Wire to the Octavian adapter when #32 ships; `Synth` extensions become thin wrappers.                                                                                                                                                     |

## Acceptance Criteria

Each criterion is a concrete pass/fail check.

**Scheduler correctness**

- **AC-16-01**: A 16-step sequencer pattern at 120 BPM plays for at least 4 consecutive loops without audible timing drift, confirmed by manual audio smoke in Chrome, Safari, and Firefox on desktop. A Vitest unit test asserts that step `k` of loop `m` is scheduled at exactly `(m × 16 + k) × 0.5 s` with zero accumulated error (four loops, 64 total steps), using `AudioContextStub` with manually advanced `currentTime`.
- **AC-16-02**: A code review confirms no `setTimeout` or `setInterval` call drives note onset; all note events are scheduled via `AudioContext.currentTime` offsets. There is no audio recording, waveform capture, or audio file export button or API call anywhere in the sequencer or progression lab UI. Verified by Playwright asserting the absence of record/export controls and by `grep` for `MediaRecorder` in sequencer and progression source files.
- **AC-16-03**: Tempo changes applied while the sequencer is stopped take effect on the next play. Tempo changes applied while running take effect on the next loop iteration, not mid-phrase: steps within the current 16-step pass use the old interval after `setBpm()` is called mid-loop; loop 2 step 0 uses the new interval. Two Vitest unit tests assert both behaviors independently. The chord progression lab has the same semantics: `setBpm()` while running does not change inter-chord timing within the current pass; the new BPM applies from chord 0 of the next loop. A Vitest unit test asserts this progression behavior.

**Audio source**

- **AC-16-04**: The step sequencer produces output using the oscillator when `getSampleBank()` returns `null`. No error is thrown and the UI does not break. A Vitest unit test with `getSampleBank` injected as `() => null` asserts the oscillator fallback path and that no error is thrown.
- **AC-16-05**: When `getSampleBank()` returns a non-null `SampledSynth`, the sequencer UI renders a source selector with two options (`oscillator` and `samples`). When `getSampleBank()` returns `null`, the source selector is absent and no error is thrown. A Vitest unit test with a mock `SampledSynth` injected via `getSampleBank` asserts the selector is rendered. A Playwright test stubs the sample bank via `page.route()` and asserts the selector is present and switching sources does not trigger page navigation.

**Chord progression lab correctness**

- **AC-16-06**: Selecting the key of C major and adding a C major chord produces a chord whose frequencies correspond to C–E–G via `new Chord('C', 'major').notes.map(n => n.frequency)`. A Vitest unit test asserts note frequencies against the expected values.
- **AC-16-07**: A progression of 8 chords at 1-bar duration each at 120 BPM schedules the last chord onset at exactly `startTime + 7 × (60 / 120) × 4` seconds (= `startTime + 14.0 s`). A Vitest unit test measures scheduled event timestamps against expected `AudioContext.currentTime` offsets using `AudioContextStub`. A progression with a 2-bar chord followed by a 1-bar chord at 120 BPM schedules the second chord at `startTime + 8.0 s` (2 bars × 4 beats × 0.5 s/beat). A Vitest unit test asserts this. Mixed-duration onset math (alternating 1-bar and 2-bar slots) is asserted in a third unit test.

**Visual/audio synchronization**

- **AC-16-08a**: The visual step highlight does not advance until `AudioContext.currentTime >= scheduledAudioTime` for each step. A Vitest unit test with `AudioContextStub.currentTime` advanced manually asserts that `playback.currentStep` does not increment until `currentTime` reaches the enqueued `audioTime`.

**Free-play isolation**

- **AC-16-08**: Playing any sequence in the step sequencer emits zero records satisfying the `AttemptEvent` shape and leaves all FSRS card due-dates and mastery summaries unchanged. A Vitest unit test spies on the FSRS scheduling module and any mastery writer and asserts zero calls after a simulated playback session.
- **AC-16-09**: Playing any chord progression emits zero `AttemptEvent` records, does not call any FSRS update function, and leaves all FSRS card due-dates and mastery summaries unchanged. A Vitest unit test with spies on the FSRS scheduling module and mastery writer asserts all conditions.
- **AC-16-10**: The TypeScript compiler enforces the free-play boundary at compile time. `src/lib/learning/drills/sequencer-drill.test-d.ts` uses `@ts-expect-error` to assert `SequencerPattern` and `SequencerStep` are not assignable to `AttemptEvent`. `src/lib/learning/drills/progression-drill.test-d.ts` uses `@ts-expect-error` to assert `ProgressionPattern`, `ChordEvent`, and `ProgressionDrillConfig` are not assignable to `AttemptEvent`. If either `@ts-expect-error` is not triggered, `bun run check` fails. Additionally, the ESLint `no-restricted-imports` rule (see Module and Architecture Targets) makes `bun run lint` fail if any sequencer or progression file imports the attempt log, FSRS scheduling, or FSRS library. A deliberate bad import in a test-only scratch file confirms the lint rule fires before the file is removed.

**Keyboard and accessibility**

- **AC-16-11**: Every step toggle in the sequencer grid is keyboard-operable (Tab to reach, Space or Enter to toggle). A Playwright spec confirms all 16 steps are reachable and togglable without a mouse.
- **AC-16-12**: Each step is a native `<button>` with `aria-pressed={step.active}` (no `role="button"`) and a stable `aria-label` of the form `"Step N, [on|off], [note name]"` that updates when the step state changes and when the octave picker changes. A Playwright accessibility snapshot confirms all 16 labels are present and correctly formatted. A component test asserts that `aria-pressed` is present and that octave picker changes update all 16 aria-labels.
- **AC-16-13**: The chord picker, key selector, tempo input, and transport controls (play, stop, loop) are keyboard-operable and screen-reader-announced. A Playwright accessibility snapshot confirms no unlabeled interactive elements on either surface.

**Responsive layout**

- **AC-16-14**: The sequencer grid and progression lab are usable at 375 px (phone), 768 px (tablet), and 1280 px (desktop) widths. A Playwright responsive smoke test at each breakpoint confirms no horizontal overflow and all controls remain visible.

**`prefers-reduced-motion`**

- **AC-16-14a**: Under `prefers-reduced-motion: reduce`, the active step uses a CSS `outline` property rather than an animated fill or `transform`. The scheduler continues running; only the visual transition is suppressed. A Playwright test calls `page.emulateMedia({ reducedMotion: 'reduce' })` before navigating, starts playback, and asserts via computed style that the active step has an `outline` property set and no CSS animation running on step buttons. The test also asserts the step indicator continues advancing to at least step 4 within 2.1 s at 120 BPM.

**`aria-live` bar announcement**

- **AC-16-14b**: The `aria-live` region announces bar numbers only at bar boundaries (steps 0, 4, 8, 12) and does not update between them. A component test with `AudioContextStub` advances `currentStep` through all 16 positions and snapshots the live region text at each step, asserting it changes only at steps 0, 4, 8, and 12.

**`destroy()` cleanup**

- **AC-16-14c**: After `destroy()` is called on the sequencer state, advancing `vi.useFakeTimers()` by 200 ms records no additional `scheduledEvents` in `AudioContextStub`. A Vitest unit test asserts this.

**Loop=false behavior**

- **AC-16-14d**: When loop is set to false, the sequencer plays exactly one 16-step pass and transitions to `phase: 'stopped'` without scheduling additional steps. A Vitest unit test, a component test, and a Playwright spec each assert this behavior.

**SSR safety**

- **AC-16-14e**: Navigating to `/sequencer` and `/progression` completes without any console error containing `AudioContext`, `window is not defined`, or `is not defined`. Two Playwright tests (one per route) listen for `page.on('console', ...)` and fail if any such error is emitted.

**Hard invariants**

- **AC-16-15**: The ESLint `no-restricted-imports` rule prevents imports of `$lib/db` from all sequencer and progression files. Verified by `bun run lint` passing and by confirming the rule fires on a deliberate bad import in a scratch file (then removing it).
- **AC-16-16**: The ESLint `no-restricted-imports` rule prevents imports of `$lib/auth` from all sequencer and progression files. Same verification approach.

## Test Plan

### Unit tests

**`src/lib/learning/drills/sequencer-drill.spec.ts`** (maps to AC-16-01, AC-16-03, AC-16-08, AC-16-08a, AC-16-14c, AC-16-14d)

- `buildPattern() returns a SequencerPattern with exactly 16 steps`
- `buildPattern() clamps BPM below 60 to 60`
- `buildPattern() clamps BPM above 180 to 180`
- `buildPattern() initializes all steps as inactive`
- `toggleStep() flips the active flag at the given index`
- `toggleStep() does not mutate the original pattern object`
- `toggleStep() throws a RangeError when index is out of bounds (< 0 or >= 16)`
- `sequencer at 60 BPM: step interval is 1.0 s`
- `sequencer at 120 BPM: step interval is 0.5 s`
- `sequencer at 180 BPM: step interval is 0.333... s`
- `tempo change while stopped takes effect on the next start (not mid-play)` (AC-16-03)
- `tempo change while running takes effect on the next loop boundary, not mid-phrase: steps within the current 16-step pass use the old interval after setBpm() is called mid-loop; loop 2 step 0 uses the new interval` (AC-16-03)
- `four consecutive loops at 120 BPM: step k of loop m is scheduled at exactly (m × 16 + k) × 0.5 s with zero accumulated error` (AC-16-01)
- `active step schedules its assigned pitchClass+octave as a frequency: step with pc=0 octave=3 emits AudioContextStub.scheduledEvents entry with frequency matching C3 (~130.81 Hz)`
- `changing a step note from pc=0 to pc=7 (G) updates the frequency in the next scheduled event`
- `playback.currentStep does not advance until AudioContext.currentTime >= the enqueued audioTime` (AC-16-08a)
- `destroy() clears the poll interval: after destroy(), advancing vi.useFakeTimers() by 200 ms records no additional AudioContextStub.scheduledEvents` (AC-16-14c)
- `stop() halts scheduling and preserves the current pattern; phase transitions to stopped`
- `when loop is false, phase transitions to stopped after step 15 fires and no further steps are scheduled` (AC-16-14d)
- `a completed sequencer session emits zero AttemptEvents and leaves FSRS card due-dates and mastery summaries unchanged: spy on FSRS scheduling module and any mastery writer; assert zero calls` (AC-16-08)

**`src/lib/learning/drills/progression-drill.spec.ts`** (maps to AC-16-06, AC-16-07, AC-16-09)

- `buildProgression() returns events matching the requested chord symbols`
- `buildProgression() with key 'C' and chord 'C major' resolves to frequencies for C–E–G`
- `buildProgression() with key 'G' and chord 'G major' resolves to frequencies for G–B–D`
- `buildProgression() enforces minimum 1-bar duration per chord event`
- `buildProgression() rejects a chord count greater than 8`
- `scheduleProgression() at 120 BPM: first chord at startTime + lookahead`
- `scheduleProgression() at 120 BPM with 8 x 1-bar chords: last chord at startTime + 7 bars (= startTime + 14.0 s)` (AC-16-07)
- `scheduleProgression() at 60 BPM: inter-chord gap is 4.0 s (one bar = 4 beats × 1 s/beat)`
- `scheduleProgression() with a 2-bar chord followed by a 1-bar chord at 120 BPM: second chord onset at startTime + 4.0 s` (AC-16-07)
- `scheduleProgression() with alternating 1-bar and 2-bar durations: each chord onset equals cumulative sum of preceding bar counts × barDuration` (AC-16-07)
- `setBpm() while progression is running does not change inter-chord timing within the current pass; new tempo applies from chord 0 of the next loop` (AC-16-03)
- `cancelProgression() stops all further scheduled events and does not clear the current pattern`
- `a completed progression session emits zero AttemptEvents, makes zero FSRS calls, and leaves all mastery summaries unchanged: spy on FSRS scheduling module and any mastery writer; assert zero calls` (AC-16-09)

**`src/lib/audio.spec.ts` — additions** (maps to AC-16-04)

- `scheduleNote() passes the atTime argument to OscillatorNode.start()`
- `scheduleNote() does not call stopAll() before scheduling`
- `scheduleNote() registers the voice so stopAll() can cancel a pending scheduled source`
- `playChord() schedules all chord frequencies without calling stopAll()`
- `playChord() registers all voices so stopAll() cancels them`
- `oscillator fallback: sequencer plays without error when getSampleBank() returns null` (AC-16-04)

**Type-level tests** (maps to AC-16-10)

- `src/lib/learning/drills/sequencer-drill.test-d.ts`: `SequencerPattern is not assignable to AttemptEvent (@ts-expect-error)`
- `src/lib/learning/drills/sequencer-drill.test-d.ts`: `SequencerStep is not assignable to AttemptEvent (@ts-expect-error)`
- `src/lib/learning/drills/progression-drill.test-d.ts`: `ProgressionPattern is not assignable to AttemptEvent (@ts-expect-error)`
- `src/lib/learning/drills/progression-drill.test-d.ts`: `ChordEvent is not assignable to AttemptEvent (@ts-expect-error)`
- `src/lib/learning/drills/progression-drill.test-d.ts`: `ProgressionDrillConfig is not assignable to AttemptEvent (@ts-expect-error)`

### Component tests (vitest-browser-svelte)

All component tests import the test harness (`step-sequencer.test-harness.svelte` or `chord-progression-lab.test-harness.svelte`), not the component directly.

**`src/lib/components/step-sequencer.svelte.test.ts`** (maps to AC-16-11, AC-16-12, AC-16-14b, AC-16-14d)

- `renders exactly 16 step buttons`
- `each step button has aria-pressed (no role="button")`
- `clicking a step button calls toggleStep with the correct index`
- `aria-label for an inactive step reads "Step N, off, [note name]"`
- `aria-label for an active step reads "Step N, on, [note name]"`
- `aria-label updates after toggle`
- `octave picker change updates all 16 step aria-labels with the new octave note names` (AC-16-12)
- `aria-label note name matches the step pitchClass in the current octave`
- `play button is present with aria-label "Start sequencer"`
- `stop button aria-label changes to "Stop sequencer" after playback starts`
- `all 16 step buttons are reachable in Tab order`
- `aria-live region content is "Bar 1" at step 0, "Bar 2" at step 4, "Bar 3" at step 8, "Bar 4" at step 12` (AC-16-14b)
- `aria-live region content does not change at steps 1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15` (AC-16-14b)
- `loop toggle disables looping; after one full pass the component renders phase=stopped and the play button label returns to "Start sequencer"` (AC-16-14d)
- `renders step-active class (not step-animated class) when prefers-reduced-motion is reduce`

**`src/lib/components/chord-progression-lab.svelte.test.ts`** (maps to AC-16-06, AC-16-13)

- `renders a key selector with one option per major key (12 total)`
- `renders chord symbols for the selected key after a key is chosen`
- `play button is disabled when no key is selected`
- `play button becomes enabled after a key is selected and at least one chord is added`
- `changing the key selector rebuilds the chord display`
- `play button has aria-label "Start progression"`
- `chord slot with duration=2 is rendered distinctly from duration=1 (wider visual width or "2 bars" label)`
- `loop toggle is present, defaults to on (aria-pressed="true"), and toggles off`

### Playwright specs

**`e2e/sequencer.spec.ts`** (maps to AC-16-01, AC-16-02, AC-16-05, AC-16-11, AC-16-12, AC-16-14, AC-16-14a, AC-16-14b, AC-16-14d, AC-16-14e)

- `user can navigate to /sequencer`
- `server-renders without AudioContext error: page.goto('/sequencer') completes with no console error containing 'AudioContext' or 'window is not defined'` (AC-16-14e)
- `user can activate a step and see it marked as active`
- `user can start playback and the step indicator advances`
- `user can stop playback and the step indicator halts`
- `keyboard: Tab navigates through all 16 steps without skipping` (AC-16-11)
- `keyboard: Space toggles a focused step between on and off` (AC-16-11)
- `keyboard: Enter toggles a focused step between on and off`
- `keyboard: Space on the play button starts playback`
- `all 16 step aria-labels present and match format "Step N, [on|off], [note name]"` (AC-16-12)
- `aria-labels update after toggle`
- `octave picker change is reflected in step aria-labels without page reload` (AC-16-12)
- `no record, waveform-capture, or export controls present in DOM` (AC-16-02)
- `no mixer or per-step FX chain controls present in DOM` (AC-16-02)
- `reduced-motion: step highlight uses outline, not animated fill — page.emulateMedia({ reducedMotion: 'reduce' }), start playback, assert active step outline is visible and no CSS animation runs on step buttons` (AC-16-14a)
- `reduced-motion: scheduler continues advancing — step indicator advances to at least step 4 within 2.1 s at 120 BPM despite reduced-motion preference` (AC-16-14a)
- `aria-live region announces bar number at step 0 start: region text contains "Bar 1" within 200 ms of play start` (AC-16-14b)
- `aria-live region does not announce between bar boundaries: within the first bar (steps 1–3) the region text remains "Bar 1"` (AC-16-14b)
- `with loop off, playback stops after one 16-step pass and the play button re-enables` (AC-16-14d)
- `when sample bank is stubbed as available via page.route(), a source selector (oscillator / samples) is rendered on the page` (AC-16-05)
- `switching source selector from oscillator to samples does not trigger a page navigation` (AC-16-05)
- `responsive: no horizontal overflow at 375 × 812` (AC-16-14)
- `responsive: all controls visible at 768 × 1024`
- `responsive: all controls visible at 1280 × 800`

**`e2e/progression-lab.spec.ts`** (maps to AC-16-05, AC-16-13, AC-16-14, AC-16-14e)

- `user can navigate to /progression`
- `server-renders without AudioContext error: page.goto('/progression') completes with no console error containing 'AudioContext' or 'window is not defined'` (AC-16-14e)
- `user can select a key and see chord options`
- `user can add chords to the progression (up to 8)`
- `user can start playback and the play button changes to stop`
- `user can stop playback and the stop button changes to play`
- `chord picker, tempo input, and transport controls are all keyboard-operable` (AC-16-13)
- `Playwright accessibility snapshot: no unlabeled interactive elements`
- `2-bar chord slot is rendered with a distinct visual width or label compared to a 1-bar slot`
- `changing BPM while progression is stopped takes effect when playback starts`
- `loop toggle defaults to on and can be switched off before playback begins`
- `responsive: no horizontal overflow at 375 × 812` (AC-16-14)
- `responsive: all controls visible at 768 × 1024`
- `responsive: all controls visible at 1280 × 800`

### ESLint gate test

Add a named step to the test plan: `ESLint gate — the no-restricted-imports rule fires when attempt-log or FSRS is imported from a sequencer or progression file: introduce a deliberate bad import in a scratch file, confirm bun run lint fails, then remove the bad import.` (AC-16-10, AC-16-15, AC-16-16)

### Manual smoke tests (required before milestone sign-off)

- Chrome, Safari, Firefox (desktop): 16-step loop at 60 BPM, 120 BPM, and 180 BPM — no audible timing drift across at least 4 consecutive loops (AC-16-01).
- Chrome, Safari (desktop): 4-chord progression in C major at 120 BPM, 1 bar per chord — blocked chord playback sounds correct (C–E–G, F–A–C, G–B–D, C–E–G), loops cleanly (AC-16-02).
- Chrome, Safari (desktop): confirm no hanging notes after stop in either surface.
- Chrome mobile (375 px): layout does not overflow, play/stop controls reachable by touch (AC-16-14).
- VoiceOver (macOS Safari) and NVDA (Windows Chrome): navigate the sequencer grid and progression chord picker without a mouse; confirm step toggles and transport controls are reachable and announceable.

## Verification

Run the standard gate in order:

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

Additional verification steps:

- Confirm `bun run check` catches any `@ts-expect-error` that does not trigger (type-level boundary tests in `*.test-d.ts`).
- Confirm `bun run lint` fails when a deliberate bad import of `ts-fsrs` or `$lib/db` is introduced in a sequencer file (ESLint gate), then remove the bad import.
- `grep -r 'MediaRecorder' src/routes/sequencer src/routes/progression src/lib/state/sequencer.svelte.ts src/lib/state/progression.svelte.ts` returns no results (AC-16-02).
- Manual audio smoke tests listed in the Test Plan above.

## Non-Goals

- Do not turn the step sequencer into a DAW, multi-track recorder, or drum machine.
- Do not add per-step velocity editing, swing, or humanization in this milestone.
- Do not add pattern save/load to the step sequencer in this milestone.
- Do not add Standard MIDI File export (Octavian #38). Resolved NO for this milestone.
- Do not add performance-capture recording or timing-quantization helpers (Octavian #37). Resolved NO for this milestone.
- Do not add arpeggiated chord playback. Blocked playback only; arpeggiated is a future enhancement.
- Do not render chord progressions on a music staff or in any notation format.
- Do not add a free-form Roman numeral text parser or progression import.
- Do not add signal visualizations (Cinder #324). Progressive enhancement only; the sequencer and progression lab must be fully operable without it. If #324 is unresolved, omit the visualizer entirely—do not ship a placeholder canvas.
- Do not add the Today surface or any cross-track recommendation logic.
- Do not add Producer track drills, EQ-band identification, compression detection, or any audio-engineering listening exercises. Those belong in milestone 15.
- Do not add launch documentation.
- Do not make either surface generate attempt events, update FSRS state, or appear in learning-progress summaries.
- Do not introduce a `FreePlayEvent` type or touch `vibratone:attempts:v1`. Free-play analytics are deferred.
- Do not add auth, billing, cloud sync, or a database.
- Do not create or modify any file under `src/lib/learning/scheduling`, `src/lib/learning/analytics`, or `src/lib/learning/protocols`. The step sequencer and chord progression lab are entirely outside the learning evidence pipeline. The isolation boundary is enforced by the ESLint `no-restricted-imports` rule.
- Do not extract sequencer or progression logic into `@lostgradient/browser-audio` or any other package until real reuse outside Vibratone is demonstrated.
- Do not describe either tool as improving absolute pitch, relative pitch, or any measurable hearing skill. Marketing copy should position them as creative free-play tools that use the same audio engine as the ear training drills.

## Completion Signal

This milestone is complete when a learner can build a 16-step rhythmic pattern and a chord progression of up to 8 chords, hear both played back through the lookahead scheduler with no audible drift, operate both surfaces entirely by keyboard, and produce zero learning-evidence events in the process. All named unit tests, component tests, type-level tests, and Playwright specs pass. The standard gate (`bun run check`, `bun run lint`, `bun run test:unit -- --run`, `bun run test:e2e`) is green. The ESLint `no-restricted-imports` rule is in place and verified. No auth or database is required.
