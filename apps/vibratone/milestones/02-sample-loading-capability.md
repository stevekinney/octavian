# 02. Sample-Loading Capability

## Outcome

Learners can choose a Piano or Guitar timbre while practicing single-note identification immediately after this milestone ships. This is intentional early exposure—tonal exploration is useful before research-aligned multi-timbre prompt banks arrive in milestone 04. The selector is not flag-gated.

The existing note trainer plays a sampled piano or guitar timbre in addition to the existing synth oscillator, routed through the milestone 01 lookahead scheduler. No new learner-facing drill type is introduced. The output is a verified, reusable capability—`src/lib/sample-loader.ts` and a timbre selector in `practice-card.svelte`—that milestone 04 (AP Trainer MVP) consumes directly when it adds real prompt banks. The loader ships as a production-quality module, not a throwaway spike.

## Product Requirements

- Build the reusable sample-loading subsystem: `loadSample`, `scheduleSample`, a typed `SampleLoadError`, and a `SampledSynth` class that wraps `AudioBufferSourceNode` playback.
- Extend the existing note trainer to expose a timbre selector with at least three options: Synth, Piano (sampled), Guitar (sampled).
- Selecting Piano or Guitar causes the next Play action to load the corresponding sample and schedule it through the milestone 01 scheduler, not via a fire-and-forget call.
- Persist the selected timbre in `localStorage` under the existing `SETTINGS_KEY` so it survives a page reload.
- When `decodeAudioData` fails or a sample fetch returns a network error, the drill does not break. An accessible error indicator is visible, a retry action is offered, and the Play button remains enabled (falling back to the existing `Synth` so the drill stays interactive).
- Samples are served as SvelteKit static assets from `/samples/piano/` and `/samples/guitar/`. No CDN or external audio service is contacted at runtime. This preserves local-first and offline posture.
- The single `AudioContext` created by `getSynth()` is shared between `Synth` and `SampledSynth`. `SampledSynth` accepts a caller-provided `AudioContext`; it does not create its own. Both share the same `currentTime` reference, which is the integration contract with the milestone 01 scheduler.
- Promise-based `decodeAudioData` (`await context.decodeAudioData(arrayBuffer)`) is used throughout—supported in Chrome 49+, Firefox 36+, Safari 14.1+. A comment in `sample-loader.ts` records this minimum Safari version so a future support-matrix change is caught explicitly.
- `AudioBufferSourceNode` is created fresh for every play call. The node can only be started once; reuse is a silent failure mode.

### Asset Sourcing

**The stub plan unblocks all implementation work.** Coding can start immediately using synthetic `AudioBuffer` fixtures. Real licensed assets are a named **completion gate**, not a start gate: AC-02-11 cannot be signed off and the milestone cannot close without real piano and guitar samples committed to `static/samples/`.

Before milestone close, a team member must:

- Verify the license terms of the chosen source against the actual license file (not a summary).
- Commit a `static/samples/LICENSE.md` manifest documenting source, version, and license terms.
- Confirm the assets pass AC-02-11 (audible tonal distinction confirmed by a human in both Chrome and Safari).

**Asset specifications:**

- **Coverage:** Three octaves of piano (C3–C5 minimum, matching the Wong protocol's 800 ms piano tones). One reference pitch per key for guitar (single-octave chromatic sufficient for v1 timbre distinction).
- **Format:** OGG Vorbis primary with MP3 fallback. Both formats required—Safari does not decode OGG without fallback.
- **Velocity layers:** None in v1. Single dynamic per pitch.
- **In-repo location:** `static/samples/piano/` and `static/samples/guitar/`, served at `/samples/…` at runtime.
- **License:** Creative Commons CC0 or equivalent. Acceptable candidates include the University of Iowa Electronic Music Studios piano samples (CC) and the MIDI.js soundfonts (CC-BY). Verify the actual license text before committing any file—do not rely on a summary.
- **Future extraction:** `@lostgradient/music-assets` is the eventual home once a second product needs these files. Do not extract now; note the boundary.

**Stub/mock plan:** Render a synthetic `AudioBuffer` via `OfflineAudioContext`, reusing the existing `pluckEnvelope` and `PIANO_FILTER_SWEEP` parameters from `src/lib/audio.ts`. Commit a minimal test fixture to `static/samples/test/silence.wav` so implementation and tests can proceed without blocking on asset licensing. Unit tests use a mock `AudioContext`. E2E tests intercept `/samples/**` with a minimal WAV buffer via `route.fulfill`. Neither path is `true` in production when a real asset is missing.

### Single-Anchor Playback-Rate Strategy (v1 Scope Decision)

For v1, one anchor sample per instrument (A4, MIDI 69) is decoded and `AudioBufferSourceNode.playbackRate` is set to `2^((targetMidi - 69) / 12)` to cover the full pitch range. At ±24 semitones from the anchor, formant shift and duration artifacts are audible. This is a known limitation, documented in a code comment in `sample-loader.ts` and in the completion note. The multi-sample bank upgrade path (one sample per octave per instrument, resolved via a manifest) is the milestone 07 concern.

## User Experience Requirements

- The existing note drill still plays, replays, accepts answers, shows correctness, updates score, and persists settings. No regression is acceptable.
- A timbre selector exposes Synth, Piano, and Guitar options in the current note trainer UI. The selector is accessible as a labeled group (radio group or `<select>`) and is usable on phone, tablet, and desktop.
- While a sample is loading, the Play button exposes `aria-busy="true"` and its accessible name conveys the loading state ("Loading sample…"). Once loaded, the button returns to its normal accessible name ("Play the note").
- When loading fails, a visible, accessible error indicator appears near the Play button. The Play button remains enabled. The drill is still usable via the existing synth fallback.
- A retry action is available on error, with accessible label "Try again". Clicking it re-initiates the fetch and decode pipeline by calling `state.setTimbre(state.timbre)`.
- Switching timbre while a note is playing calls `stopAll()` on the active `SampledSynth` before switching, to prevent audio overlap.
- Audio is decoded and played entirely client-side using `decodeAudioData` and `AudioBufferSourceNode`. No audio data leaves the browser.

## Data and Analytics Requirements

- Milestone 02 defines `TimbreId` in `src/lib/sample-loader.ts`, which includes `'sampled-piano'` and `'sampled-guitar'` alongside the existing `'sine'`, `'warm'`, and `'piano'` synth timbres. The existing `Score`/`applyGuess` flow in `state.svelte.ts` is preserved unchanged.
- `TimbreId` is exported alongside an `as const` array `TIMBRE_IDS` from `sample-loader.ts` so other modules (including `persistence.ts` type guards) derive from a single source of truth, not a parallel hardcoded set.
- Milestone 04, when it builds attempt-event logging on top of milestone 00's `AttemptEvent`, consumes `TimbreId` directly. Milestone 02 contributes the type; milestone 04 wires it into the event log.
- This milestone does not introduce FSRS scheduling or analytics dashboards.
- No data leaves the browser.

## Accessibility Requirements

- The timbre selector has an accessible label ("Instrument" or equivalent).
- The Play button exposes `aria-busy="true"` while an `AudioBuffer` is decoding.
- On decode or network failure, a live region with `role="alert"` announces the failure immediately. The error container carries `aria-live="assertive"` so screen readers surface it without delay.
- The retry button has an accessible name ("Try again") that is not merely a visible icon label.
- All new controls (timbre selector, Play, Replay, error indicator, retry) are reachable and operable by keyboard alone.
- Responsive smoke tests include at least one keyboard-only navigation path through the timbre selector and Play button, including at the phone (390 px) viewport.

## Module and Architecture Targets

### New File: `src/lib/sample-loader.ts`

Owns sample loading, decoding, scheduling, and error state. Does not own `AudioContext` lifecycle—that stays in `getSynth()` in `src/lib/audio.ts`. Does not use runes; this is a plain TypeScript module consumed by the `.svelte.ts` factory.

**Public surface (stable for milestone 04):**

```ts
/** An `as const` array of all valid timbre ids. Single source of truth for type guards. */
export const TIMBRE_IDS = ['sine', 'warm', 'piano', 'sampled-piano', 'sampled-guitar'] as const;

/** Timbre values available after this milestone (extends the existing Tone union). */
export type TimbreId = (typeof TIMBRE_IDS)[number];

/** Identifies a sampled instrument. */
export type InstrumentId = 'piano' | 'guitar';

/** Typed error returned when loading or decoding a sample fails. */
export type SampleLoadError = {
	type: 'network-failed' | 'decode-failed';
	url: string;
	cause: unknown;
};

/**
 * Fetch and decode an audio sample. Deduplicates concurrent requests for the
 * same URL — exactly one fetch is in flight per URL at any time.
 * Returns a decoded AudioBuffer on success; rejects with SampleLoadError on failure.
 * A failed load is NOT cached — a subsequent call retries the fetch.
 * Uses module-level Map caches: `inFlight: Map<string, Promise<AudioBuffer>>`
 * and `decoded: Map<string, AudioBuffer>`. Cache key is the full URL string.
 * MUST be called with a live AudioContext (after a user gesture). Safari 14.1+ required.
 */
export function loadSample(url: string, context: AudioContext): Promise<AudioBuffer>;

/**
 * Low-level helper: creates a fresh AudioBufferSourceNode, connects it to destination,
 * sets playbackRate, and calls node.start(when) — where `when` is an absolute
 * AudioContext.currentTime value passed by the milestone 01 scheduler's tick callback.
 * Returns the node. Prefer SampledSynth.play() in consumer code — this helper
 * is for callers that manage their own voice tracking.
 */
export function scheduleSample(
	buffer: AudioBuffer,
	when: number,
	context: AudioContext,
	destination: AudioNode,
	playbackRate?: number
): AudioBufferSourceNode;

/**
 * Convert a MIDI pitch number to an AudioBufferSourceNode playbackRate relative
 * to an anchor pitch. At ±24 semitones from anchor, formant and duration artifacts
 * are audible (known v1 limitation; multi-sample bank is the milestone 07 upgrade path).
 */
export function pitchToPlaybackRate(targetMidi: number, anchorMidi: number): number;

/**
 * pitchToMidi stub — convert { pc: PitchClass, octave: number } to MIDI number.
 * Extract to octavian (#17) when available.
 */
// const pitchToMidi = (pitch: Pitch): number => pitch.octave * 12 + pitch.pc + 12;
```

**`SampledSynth` class** (in `src/lib/sample-loader.ts`):

```ts
type SampledVoice = { source: AudioBufferSourceNode; gain: GainNode };

export class SampledSynth {
	// Plain instance properties — not runes. Reactive mirrors live in state.svelte.ts.
	status: 'idle' | 'loading' | 'ready' | 'error';
	error: SampleLoadError | null;
	readonly instrumentId: InstrumentId;
	readonly anchorMidi: number; // A4 = 69 for v1

	#context: AudioContext | null;
	#buffer: AudioBuffer | null;
	#voices: Set<SampledVoice>;

	constructor(instrumentId: InstrumentId, anchorMidi: number);

	/** Fetch and decode the sample. Call inside a user gesture or onMount. */
	async load(url: string, context: AudioContext): Promise<void>;

	/**
	 * Schedule playback at the given AudioContext.currentTime absolute value.
	 * Creates source → gain → destination, registers the voice pair, calls source.start(when).
	 * Calls context.resume() (fire-and-forget via void) before createBufferSource
	 * when context.state is 'suspended'. Returns void (synchronous scheduler contract).
	 */
	play(context: AudioContext, destination: AudioNode, midiPitch: number, when: number): void;

	/** Ramp all active voices down quickly (60 ms), matching Synth.stopAll() behavior. */
	stopAll(): void;
}

/**
 * Module-level factory: returns a cached SampledSynth per InstrumentId.
 * Returns null when typeof window === 'undefined' (SSR guard, matching getSynth()).
 */
export function getSampledSynth(instrumentId: InstrumentId): SampledSynth | null;
```

**`SampledSynth.stopAll()` voice ramp pattern** (matches `Synth.stopAll()` in `audio.ts`):

```ts
stopAll(): void {
  const now = this.#context!.currentTime;
  for (const { source, gain } of this.#voices) {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
    gain.gain.linearRampToValueAtTime(0, now + 0.06);
    try { source.stop(now + 0.07); } catch { /* already stopped */ }
  }
  this.#voices.clear();
}
```

**`loadSample` cache architecture:**

```ts
// Module-level caches in src/lib/sample-loader.ts
const inFlight = new Map<string, Promise<AudioBuffer>>();
const decoded = new Map<string, AudioBuffer>();

export function loadSample(url: string, context: AudioContext): Promise<AudioBuffer> {
	const cached = decoded.get(url);
	if (cached) return Promise.resolve(cached);
	const existing = inFlight.get(url);
	if (existing) return existing;

	const promise = fetch(url)
		.then((response) => {
			if (!response.ok) {
				throw {
					type: 'network-failed',
					url,
					cause: new Error(`HTTP ${response.status}`)
				} satisfies SampleLoadError;
			}
			return response.arrayBuffer();
		})
		.then((buffer) => context.decodeAudioData(buffer))
		.then((audioBuffer) => {
			decoded.set(url, audioBuffer);
			inFlight.delete(url);
			return audioBuffer;
		})
		.catch((cause) => {
			inFlight.delete(url); // evict on failure so retry is possible
			const isLoadError = (e: unknown): e is SampleLoadError =>
				typeof e === 'object' && e !== null && 'type' in e;
			throw isLoadError(cause)
				? cause
				: ({ type: 'decode-failed', url, cause } satisfies SampleLoadError);
		});

	inFlight.set(url, promise);
	return promise;
}
```

### Modified File: `src/lib/audio.ts`

- Add a `context` getter to the `Synth` class so callers can pass the shared `AudioContext` to `SampledSynth.load()` and `SampledSynth.play()` without constructing a second one:

  ```ts
  /** The shared AudioContext. Pass to SampledSynth.load() and SampledSynth.play(). */
  get context(): AudioContext {
    return this.#context;
  }
  ```

- Update the `Tone` type comment to document the upcoming `TimbreId` union (milestone 02 introduces it in `sample-loader.ts` rather than extending `Tone` directly, to avoid breaking existing call sites).
- No other changes to `audio.ts`; all new audio code goes in `sample-loader.ts`.

### Modified File: `src/lib/state.svelte.ts`

- Gains `let timbre = $state<TimbreId>('sine')` initialized from persisted settings (replaces any existing `tone: Tone` field).
- Gains two reactive mirrors for the non-reactive `SampledSynth` fields:
  ```ts
  let samplerStatus = $state<SampledSynth['status']>('idle');
  let samplerError = $state<SampleLoadError | null>(null);
  let sampledSynth = $state.raw<SampledSynth | null>(null); // AudioBuffer must not be proxied
  ```
- `setTimbre(id: TimbreId)` action: guards against in-flight loads; calls `stopAll()` on any active `SampledSynth` if a note is playing; updates `timbre`; persists the selection; initiates `sampledSynth.load(...)` if switching to a sampled timbre; writes `samplerStatus` and `samplerError` mirrors after each await boundary.
- `sound()` dispatches to `getSynth()` for `'sine' | 'warm' | 'piano'` and to `sampledSynth` for `'sampled-piano' | 'sampled-guitar'`. Uses a type guard `isSynthTimbre(id: TimbreId): id is Tone` backed by `TIMBRE_IDS` to narrow the dispatch without widening `PlayOptions.tone`.
- `canPlay` is `$derived(available > 0 && samplerStatus !== 'loading')` — reacts to the plain `$state` mirror, not the `$state.raw` instance.
- Exposes `samplerStatus` and `samplerError` on the returned state object so components can render the correct accessible state.
- `destroy()` is extended to call `stopAll()` on any active `SampledSynth`.
- `sampler.load()` is called from within the `setTimbre()` action (same call stack as the user gesture), not from a `$effect`. Effects synchronize with external state; they do not initiate async browser-API calls that depend on user-gesture timing.

### Modified File: `src/lib/persistence.ts`

- `PersistedSettings` gains an optional `timbre?: TimbreId` field.
- `isPersistedSettings` guard is updated: if `timbre` is present, validate it against `TIMBRE_IDS` (imported from `sample-loader.ts`). If `timbre` is present but not a valid `TimbreId`, the guard returns `false` and default settings (`timbre: 'sine'`) are used. Do not silently coerce unknown timbre strings.

  ```ts
  import { TIMBRE_IDS } from './sample-loader.ts';
  const validTimbreIds = new Set<string>(TIMBRE_IDS);
  // in guard:
  candidate.timbre === undefined || validTimbreIds.has(candidate.timbre as string);
  ```

### Modified File: `src/lib/components/practice-card.svelte`

- Adds a timbre selector rendered as a labeled radio group or `<select>` with options: Synth, Piano, Guitar.
- The selector calls `state.setTimbre(id)` on change.
- The Play button gains `aria-busy={state.samplerStatus === 'loading'}` and `aria-label` switching to "Loading sample…" while loading.
- An inline error indicator (`role="alert"`, `aria-live="assertive"`) appears when `state.samplerError` is non-null, with a "Try again" button that calls `state.setTimbre(state.timbre)` to re-initiate loading.

### New File: `src/lib/sample-loader.spec.ts`

Unit tests — see Test Plan. Runs in the **server** (node) vitest project. No rune calls in `sample-loader.ts`; `AudioContext` is stubbed with a minimal mock.

### New File: `src/lib/state.svelte.spec.ts`

State integration tests — see Test Plan. Runs in the **server** (node) vitest project. This file does not exist before milestone 02; it is created as part of this milestone's implementation setup. (It is also consumed by future milestones.)

### Modified File: `src/lib/components/practice-card.svelte.test.ts`

Component tests for the new timbre selector and accessible states — see Test Plan. Runs in the **client** (browser) vitest project via `vitest-browser-svelte`, matching the existing `score-bar.svelte.test.ts` pattern.

### New File: `e2e/sample-loading.e2e.ts`

Playwright e2e specs — see Test Plan. File extension `.e2e.ts` is required by the `**/*.e2e.{ts,js}` testMatch in `playwright.config.ts`.

### New Fixture: `static/samples/test/silence.wav`

A 46-byte minimal valid WAV (44-byte PCM header + 2 bytes of silence at 44100 Hz, 1 channel, 16-bit) committed to the repo so unit tests and e2e stubs have a concrete fixture:

```ts
function minimalWavBuffer(): Buffer {
	const buf = Buffer.alloc(46);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(38, 4);
	buf.write('WAVE', 8);
	buf.write('fmt ', 12);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(44100, 24);
	buf.writeUInt32LE(88200, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(2, 40);
	return buf;
}
```

Note: `RIFF` chunk size at bytes 4–7 is `file_size - 8 = 38`; `data` subchunk size at bytes 40–43 is `2`. These must match exactly or `decodeAudioData` will reject the buffer.

### SSR Safety Contract

All code introduced by this milestone that touches browser-only APIs follows the rule established in `src/lib/audio.ts`:

- `AudioContext` construction: lazy, inside a user gesture or `onMount`, never at module load.
- `decodeAudioData`: called only after a context exists and only in browser scope.
- `getSampledSynth()` returns `null` when `typeof window === 'undefined'`, matching `getSynth()`.
- The `SampledSynth` instance held in `state.svelte.ts` is never touched during SSR hydration.
- `fetch` inside `loadSample()` is called only inside user-gesture paths, never at module scope.

`bun run build` must complete without server-side reference errors in addition to the standard `bun run check`.

## Dependencies

- **Milestone 01** (Lookahead Audio Scheduler): `scheduleSample` accepts a `when` parameter as an absolute `AudioContext.currentTime` value supplied by the scheduler's tick callback. The scheduler's public contract is `schedule(callback: (when: number) => void, intervalMs: number): SchedulerHandle` where `when` is passed to the callback; `scheduleSample` (and `SampledSynth.play()`) are called _from within_ the callback, not by the scheduler itself. The scheduler does not hold `AudioBufferSourceNode` references. The shared `AudioContext` from `getSynth()` (established by milestone 01's scheduler integration) is passed to `SampledSynth.load()` and `SampledSynth.play()` via `getSynth()!.context`.

## External Dependency Contracts

| Capability                                            | Contract                                                                                         | Owner                                                             | Stub/Mock Plan                                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real piano samples (3+ octaves, OGG + MP3)            | Licensed CC0/equivalent; served from `static/samples/piano/`; commit `static/samples/LICENSE.md` | Team member assigned at milestone start                           | Synthetic stub via `OfflineAudioContext` + `pluckEnvelope` unblocks all coding. Real assets required only for AC-02-11 sign-off and production deployment.                      |
| Real guitar samples (chromatic anchor set, OGG + MP3) | Same license requirement; served from `static/samples/guitar/`                                   | Same assignee                                                     | Same stub plan. Real assets required for AC-02-11 and production deployment.                                                                                                    |
| `octavian/web-audio` (#32)                            | `scheduleBuffer(context, buffer, startTime, playbackRate)` thin helper                           | [Octavian #32](https://github.com/stevekinney/octavian/issues/32) | Inline a three-line implementation in `scheduleSample()` annotated `// extract to octavian/web-audio (#32) when available`. Zero blocker.                                       |
| `pitchToMidi` helper                                  | `(pitch: { pc: number, octave: number }) => number`                                              | [Octavian #17](https://github.com/stevekinney/octavian/issues/17) | Stub inline in `sample-loader.ts`: `pitch.octave * 12 + pitch.pc + 12`. Annotate `// extract to octavian (#17) when available`. Zero blocker.                                   |
| Cinder #320 (media controls)                          | `<button>` with `loading`, `disabled`, and `aria-label` props for Play/Replay                    | [Cinder #320](https://github.com/stevekinney/cinder/issues/320)   | Plain `<button disabled={samplerStatus !== 'ready'} aria-busy={samplerStatus === 'loading'} aria-label={...}>`. One-line import swap when #320 ships. Not on the critical path. |

## Acceptance Criteria

**AC-02-01 — Decode success**
`loadSample` called with a valid OGG or MP3 URL (or a synthetic fixture) resolves with an `AudioBuffer` whose `duration` is within the expected range for the file. Verified by a vitest unit test using a mock `AudioContext` that resolves `decodeAudioData`.

**AC-02-02 — Scheduled playback through milestone 01 scheduler**
`scheduleSample(buffer, when, context, destination)` calls `source.start(when)` exactly once where `when` equals the passed future `AudioContext.currentTime` absolute timestamp. It does NOT call `source.start()` with no argument or `source.start(0)`. Verified by a vitest unit test that mocks `AudioContext` and asserts `start` was called once with the provided `when` argument.

**AC-02-03 — Timbre selection in note trainer**
The note trainer exposes a timbre selector with at least three options: Synth, Piano (sampled), Guitar (sampled). Selecting Piano or Guitar causes the next Play action to load and schedule the corresponding sample. Verified by a Playwright test that selects Piano timbre and asserts a sample load is initiated.

**AC-02-04 — Decode failure → recoverable fallback**
When `decodeAudioData` fails (network error, corrupt file, or missing asset), the drill does not break: the Play button remains enabled, an accessible error indicator with `role="alert"` is visible, and the drill remains interactive. Verified by a Playwright test that mocks a failed sample fetch and asserts the drill remains interactive.

**AC-02-05 — Accessible loading state**
While a sample is loading, the Play button exposes both `aria-busy="true"` and `aria-label="Loading sample…"` simultaneously. Once loaded, the button returns to `aria-label="Play the note"` and `aria-busy` is absent. Verified by a vitest-browser-svelte component test asserting both ARIA attributes together.

**AC-02-06 — Retry after error**
When a sample load fails and the user clicks "Try again", the fetch and decode pipeline re-initiates. If the retry succeeds, the error indicator clears and the Play button returns to normal state. Verified by a Playwright test using a call-counter route handler: first request returns 404; second returns the WAV buffer.

**AC-02-07 — One shared AudioContext**
`SampledSynth.load()` and `SampledSynth.play()` use the same `AudioContext` instance as `getSynth()`. No second `AudioContext` is created. Verified by a unit test asserting `SampledSynth.play` uses the same context reference that was passed to `load()`.

**AC-02-08 — Concurrent request deduplication**
Triggering two concurrent loads for the same sample URL results in exactly one `fetch` call. The second caller receives the same resolved `AudioBuffer`. Verified by a unit test that spies on `globalThis.fetch` (server vitest project, node environment) and asserts it was called exactly once.

**AC-02-09 — Offline / local-first**
Samples are served as static SvelteKit assets. No external network requests are made during sampled playback. Verified by a Playwright test that: (1) registers `route.fulfill` for `/samples/**` first, then (2) registers `route.abort` for all other patterns, then (3) triggers sampled playback and asserts no `requestfailed` events fire for non-localhost origins.

**AC-02-10 — Timbre persists across reload**
Selecting Piano timbre, reloading the page, and observing the timbre selector shows Piano selected. Verified by a Playwright test that sets the timbre, reloads, and asserts the selector state.

**AC-02-11 — Piano and guitar are audibly distinct**
Switching between Piano and Guitar timbres produces perceptibly different tonal character. This criterion is only evaluable against real licensed assets—the synthetic stub renders both instruments from the same parameters and will not satisfy it. One human confirmation in Chrome and one in Safari is required before the milestone is marked complete. If real assets are unavailable at milestone close, AC-02-11 is open and the milestone is incomplete.

**AC-02-12 — Responsive layouts unchanged**
Responsive Playwright smoke (phone 390 px, tablet 768 px, desktop 1280 px) passes for the note trainer with the new timbre selector visible and usable at all three widths.

**AC-02-13 — No regression on existing drill**
The full existing note-drill Playwright suite (`practice.e2e.ts`) passes without modification. Session score, all-time score, streak, and all-time reset all work correctly when Synth timbre is active.

**AC-02-14 — No AP-efficacy claims in new UI copy**
No UI string or completion-note prose introduced by this milestone contains the phrases "perfect pitch", "guaranteed", or "will learn". Verified by the grep gate in the Verification section.

## Test Plan

All `sample-loader.spec.ts` and `state.svelte.spec.ts` tests run in the **server** (node) vitest project — plain TypeScript, no rune calls. `practice-card.svelte.test.ts` additions run in the **client** (browser) vitest project via `vitest-browser-svelte`. The Playwright file is `e2e/sample-loading.e2e.ts` (required by `testMatch: '**/*.e2e.{ts,js}'`).

### Minimal AudioContext Mock (for unit tests in the node project)

```ts
function createMockAudioContext(state: AudioContextState = 'running') {
	const bufferSource = {
		start: vi.fn(),
		stop: vi.fn(),
		connect: vi.fn(),
		playbackRate: { value: 1 },
		buffer: null as AudioBuffer | null,
		addEventListener: vi.fn(),
		onended: null
	};
	return {
		state,
		currentTime: 0,
		resume: vi.fn().mockResolvedValue(undefined),
		decodeAudioData: vi
			.fn()
			.mockResolvedValue({ duration: 1.0, sampleRate: 44100 } as unknown as AudioBuffer),
		createBufferSource: vi.fn().mockReturnValue(bufferSource),
		createGain: vi.fn().mockReturnValue({
			gain: {
				value: 1,
				linearRampToValueAtTime: vi.fn(),
				setValueAtTime: vi.fn(),
				cancelScheduledValues: vi.fn()
			},
			connect: vi.fn()
		}),
		destination: {},
		_bufferSource: bufferSource
	};
}
```

This mirrors the `createMockStorage` pattern already established in `persistence.spec.ts`.

### Unit Tests: `src/lib/sample-loader.spec.ts`

**`loadSample`**

- `loadSample: resolves with a decoded AudioBuffer on a valid fetch response`
- `loadSample: rejects with SampleLoadError { type: 'network-failed' } on a non-OK HTTP status (404)`
- `loadSample: rejects with SampleLoadError { type: 'network-failed' } when fetch rejects (network timeout)`
- `loadSample: rejects with SampleLoadError { type: 'decode-failed' } when decodeAudioData rejects`
- `loadSample: deduplicates concurrent requests — exactly one fetch call for the same URL` _(spy on `globalThis.fetch`; assert call count === 1; both awaiters receive the same resolved buffer)_
- `loadSample: a second call after the first resolves returns the cached AudioBuffer without fetching again`
- `loadSample: a failed load is not cached — a subsequent call re-fetches`
- `loadSample: fetching a second distinct URL after the first resolves makes a new fetch call and returns a different AudioBuffer` _(no cross-URL cache pollution)_
- `loadSample: cache key is the full URL string including query params`

**`SampleLoadError`**

- `SampleLoadError: wraps the original cause and exposes it via .cause`
- `SampleLoadError: is identifiable with instanceof SampleLoadError`

**`pitchToPlaybackRate`**

- `pitchToPlaybackRate: returns 1.0 for the anchor pitch (MIDI 69 → 69)`
- `pitchToPlaybackRate: returns 2.0 for one octave above the anchor (MIDI 81)` _(expected: exactly `2`)_
- `pitchToPlaybackRate: returns 0.5 for one octave below the anchor (MIDI 57)` _(expected: exactly `0.5`)_
- `pitchToPlaybackRate: returns ~0.5946 for C4 (MIDI 60) from A4 anchor` _(expected: `toBeCloseTo(2 ** ((60 - 69) / 12), 6)`)_
- `pitchToPlaybackRate: returns ~1.4983 for D5 (MIDI 74) from A4 anchor` _(expected: `toBeCloseTo(2 ** ((74 - 69) / 12), 6)`)_
- `pitchToPlaybackRate: returns correct ratio at 24 semitones above anchor (MIDI 93)` _(expected: `toBeCloseTo(2 ** (24 / 12), 6)` ≈ 5.657)_
- `pitchToPlaybackRate: returns correct ratio at 24 semitones below anchor (MIDI 45)` _(expected: `toBeCloseTo(2 ** (-24 / 12), 6)` ≈ 0.177)_

**`scheduleSample`**

- `scheduleSample: returns an AudioBufferSourceNode`
- `scheduleSample: calls node.start(when) with the provided future timestamp — not start() with no argument` _(set `when = context.currentTime + 0.5`; assert `node.start` called once with that value)_
- `scheduleSample: creates a fresh AudioBufferSourceNode on every call — never reuses the same node`
- `scheduleSample: connects the node to the provided destination before calling start`

**`SampledSynth`**

- `SampledSynth: does not construct an AudioContext in its constructor` _(no AudioContext mock needed; verifies no-own-context invariant)_
- `SampledSynth.load: status is 'loading' before the promise resolves, then 'ready' after` _(start promise without awaiting; assert `status === 'loading'`; then await; assert `status === 'ready'`)_
- `SampledSynth.load: transitions status idle → loading → error on fetch failure`
- `SampledSynth.load: transitions status idle → loading → error on decodeAudioData rejection`
- `SampledSynth.play: creates a new AudioBufferSourceNode for each invocation (never reuses)`
- `SampledSynth.play: uses the same AudioContext reference that was passed to load()`
- `SampledSynth.play: calls context.resume before context.createBufferSource when context.state is 'suspended'` _(use `vi.spyOn` and assert call order: `resume` called before `createBufferSource`)_
- `SampledSynth.stopAll: ramps gain to zero and stops active nodes`
- `SampledSynth.stopAll: does not throw when called before any note has played`

**`getSampledSynth`**

- `getSampledSynth: returns null when window is undefined (SSR guard)` _(runs naturally in the node vitest project where `window` is not defined)_

### State Integration Tests: `src/lib/state.svelte.spec.ts` (new file, server vitest project)

- `state: when timbre is 'sine', sound() dispatches to getSynth() and does not call getSampledSynth()`
- `state: when timbre is 'sampled-piano', sound() dispatches to getSampledSynth('piano') and does not call getSynth()`
- `state: when timbre is 'sampled-guitar', sound() dispatches to getSampledSynth('guitar') and does not call getSynth()`
- `state: canPlay returns false while samplerStatus is 'loading'` _(inject mock SampledSynth with status preset to 'loading')_
- `state: canPlay returns false while samplerStatus is 'error'` _(inject mock SampledSynth with status preset to 'error'; no real AudioContext needed)_
- `state: samplerStatus reflects SampledSynth.status transitions through $state — idle → loading → ready` _(use a real SampledSynth stub, not a full class mock, so the `$state` getter path is exercised)_
- `state: setTimbre persists the selection to localStorage under SETTINGS_KEY`
- `state: loading a persisted timbre of 'sampled-piano' on startup initialises SampledSynth.load()`
- `state: setTimbre calls stopAll() on the active SampledSynth before switching timbre when a note is playing`
- `state: destroy() calls stopAll() on any active SampledSynth instance`
- `state: sound() maps TimbreId 'sine' to Tone 'sine' when dispatching to Synth`
- `state: sound() maps TimbreId 'warm' to Tone 'warm' when dispatching to Synth`

### Persistence Tests: `src/lib/persistence.spec.ts` (additions)

- `isPersistedSettings: accepts settings with no timbre field (backward compatibility)`
- `isPersistedSettings: returns false when timbre field is present but not a valid TimbreId`
- `isPersistedSettings: accepts settings with a valid TimbreId value`

### Component Tests: `src/lib/components/practice-card.svelte.test.ts` (additions, client browser project)

- `timbre selector: renders options for Synth, Piano, and Guitar`
- `timbre selector: has an accessible label "Instrument" or equivalent (getByRole or getByLabelText)`
- `timbre selector: selecting Guitar calls state.setTimbre('sampled-guitar')`
- `Play button: has both aria-busy="true" and aria-label="Loading sample…" simultaneously while samplerStatus is 'loading'` _(compound assertion — satisfies WCAG 4.1.2)_
- `Play button: aria-busy is absent and aria-label returns to "Play the note" after samplerStatus transitions to 'ready'`
- `Play button: remains enabled and shows error indicator when samplerStatus is 'error'`
- `error indicator: has role="alert" when samplerStatus is 'error'`
- `error indicator: has aria-live="assertive" when samplerStatus is 'error'`
- `retry button: is present and has accessible name "Try again" when samplerStatus is 'error'`
- `retry button: calls state.setTimbre with the current timbre when clicked`
- `error indicator: is absent from the DOM (or hidden) when samplerStatus is not 'error'`

### Playwright E2E: `e2e/sample-loading.e2e.ts`

All specs use `page.route('/samples/**', route => route.fulfill({ body: minimalWavBuffer(), contentType: 'audio/wav' }))` before navigation unless stated otherwise. `minimalWavBuffer()` is a helper defined in the test file returning the 46-byte minimal valid WAV buffer.

**Happy path:**

- `selecting Piano timbre and pressing Play initiates a sample load (not synth oscillator)` _(assert a request to `/samples/piano/…` is made)_
- `selecting Guitar timbre and pressing Play initiates a separate sample load` _(assert a request to `/samples/guitar/…`)_
- `Play button becomes enabled after Piano sample loads and a note plays without error`
- `all-time score increments after a correct guess with Piano timbre active`
- `timbre selection persists after page reload` _(set Piano; reload; assert selector shows Piano)_

**Error recovery:**

- `a 404 on the sample URL shows a visible role=alert region with error text and a retry button`
- `clicking retry after a 404 re-initiates the fetch and recovers on success` _(call-counter route handler: first request returns 404; second returns the WAV buffer)_
- `switching timbre away from a failed sample clears the error state`
- `note trainer remains interactive — Play button enabled and guess accepted — when sample fetch is blocked`

**Accessibility:**

- `Tab reaches the timbre selector, Play button, and Replay button in DOM order`
- `Space on the Play button triggers sample playback with Piano timbre`
- `error live region (aria-live=assertive) is present in the DOM when error state is active`
- `aria-busy is present on Play button during loading and absent after load completes`
- `[phone 390px] Tab reaches timbre selector; ArrowDown/Space changes selection; Enter on Play button initiates playback` _(keyboard path at phone viewport)_

**Responsive smoke** (parameterised across `{ width: 390, label: 'phone' }`, `{ width: 768, label: 'tablet' }`, `{ width: 1280, label: 'desktop' }`):

- `[{label}] timbre selector is visible and operable after sample loads`
- `[{label}] Play button is visible and has correct accessible name after sample loads`

**Offline/local-first:**

- `no external network requests are made during sampled playback` _(register `/samples/**` fulfill first; then `page.route(/^(?!http:\/\/localhost)/, route => route.abort())` for all other origins; assert no `requestfailed` events fire for non-localhost origins)_

**Race conditions:**

- `rapid-replay (click Play 5× quickly) does not produce console errors or unhandled rejections` _(capture with `page.on('console', ...)` and `page.on('pageerror', ...)`; assert both arrays are empty after the sequence)_

**Regression:**

- `existing note-drill Playwright suite passes unmodified with Synth timbre active`

**Manual gate (required before marking milestone complete):**

- `[MANUAL — Chrome] Piano timbre has percussive decay; Guitar timbre has distinct tonal character at C4` _(record result in milestone completion note — satisfies AC-02-11)_
- `[MANUAL — Safari] Same as Chrome, confirming MP3 fallback decodes without console errors`

### Acceptance Criterion → Test Mapping

| AC | Named Test(s) |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------- |
| AC-02-01 | `loadSample: resolves with a decoded AudioBuffer on a valid fetch response` |
| AC-02-02 | `scheduleSample: calls node.start(when) with the provided future timestamp` |
| AC-02-03 | e2e: `selecting Piano timbre and pressing Play initiates a sample load` |
| AC-02-04 | e2e: `a 404 on the sample URL shows a visible role=alert region…`; e2e: `note trainer remains interactive … when sample fetch is blocked` |
| AC-02-05 | component: `Play button: has both aria-busy="true" and aria-label="Loading sample…" simultaneously`; e2e: `aria-busy is present on Play button during loading` |
| AC-02-06 | e2e: `clicking retry after a 404 re-initiates the fetch and recovers on success` |
| AC-02-07 | `SampledSynth.play: uses the same AudioContext reference that was passed to load()` |
| AC-02-08 | `loadSample: deduplicates concurrent requests — exactly one fetch call for the same URL` |
| AC-02-09 | e2e: `no external network requests are made during sampled playback` |
| AC-02-10 | e2e: `timbre selection persists after page reload` |
| AC-02-11 | `[MANUAL]` — human confirmation in Chrome + Safari required |
| AC-02-12 | e2e parameterised responsive smoke (phone/tablet/desktop) |
| AC-02-13 | e2e: `existing note-drill Playwright suite passes unmodified with Synth timbre active` |
| AC-02-14 | grep gate: `grep -rE "perfect pitch                                                                                                                            | guaranteed | will learn" src/` must return no matches |

## Verification

Run in order:

```sh
bun run check
bun run build       # Confirms SSR safety — no browser-API calls at module load
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

```sh
# AP-claims guard — must return no matches (AC-02-14)
grep -rE "perfect pitch|guaranteed|will learn" src/
```

```sh
# Confirm no browser-only API references at module load in sample-loader.ts
grep -n "AudioContext\|fetch\|window\|document" src/lib/sample-loader.ts \
  | grep -v "typeof window" | grep -v "// " | grep -v "AudioContext:" | grep -v "AudioNode"
# Must return no lines — AudioContext appears only as a parameter type annotation,
# never constructed at module scope.
```

Manual smokes (required before marking complete):

- **Chrome:** Switch to Piano timbre, play several notes, confirm pitch and tonal character. Switch to Guitar, confirm tonal distinction from Piano. Record result. (Satisfies AC-02-11.)
- **Safari:** Same as Chrome, confirming MP3 fallback path decodes without console errors.
- **Keyboard-only:** Navigate to timbre selector via Tab, change to Piano via arrow keys or Space, press Space/Enter on Play button, confirm audio and accessible label update.
- **Offline:** Disable network in DevTools, confirm existing Synth timbre still plays. Sampled timbres may show error state—acceptable as long as the drill does not break.

## Non-Goals

- Do not build a microphone flow, pitch detection, or mic permission handling—those belong to milestone 03.
- Do not make a notation renderer decision—that belongs to milestone 00's documented output.
- Do not add FSRS scheduling or analytics dashboards—those belong to milestone 05.
- Do not add velocity layers, round-robin sample selection, or convolution reverb—defer to a later audio-fidelity milestone.
- Do not build a CDN-backed or third-party-hosted sample delivery path. Samples are static assets only.
- Do not extract `@lostgradient/music-assets`—assets stay in Vibratone until a second product needs them.
- Do not add multi-sample banks (one sample per octave)—this is the milestone 07 upgrade path.
- Do not implement AP placement tests, timed prompts, or feedback levels—those belong to milestone 04.
- Do not introduce accounts, a database, cloud sync, or any server-side state.

## Completion Signal

This milestone is complete when:

- All unit, component, and Playwright tests pass on CI.
- `bun run build` completes without server-side reference errors.
- The grep gate (`grep -rE "perfect pitch|guaranteed|will learn" src/`) returns no matches.
- Real piano and guitar samples are present in `static/samples/` with a committed `LICENSE.md` manifest, and a human has confirmed AC-02-11 (audible tonal distinction) in both Chrome and Safari.
- The timbre selector, loading state, error state, and retry flow are accessible by keyboard and announced correctly by a screen reader in at least one manual check.
- The milestone completion note records: the asset source and license chosen, the known playback-rate quality limitation at ±24 semitones, and the `@lostgradient/music-assets` extraction boundary.
