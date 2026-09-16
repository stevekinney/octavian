# 08. AP Singing and Pitch Production

## Outcome

An AP learner who has completed milestone 07 can hear a named pitch and sing or hum it back; the app scores the attempt honestly using pitch-class match, signed cents offset, octave-error classification, and clarity-gated uncertainty. The complete AP learning path remains fully accessible to learners who decline or cannot use a microphone. Singing is an optional production branch and never gates AP level advancement.

## Product Requirements

- Introduce a sing-back prompt type: the learner hears a named pitch (e.g., "A4"), then sings or hums it; the app detects the fundamental frequency via the mic runtime established in milestone 03 and scores the result.
- Extend the `Phase` union in `src/lib/state.svelte.ts` with three singing phases: `'singing-prompt'` (mic not yet active; prompt displayed), `'singing-active'` (mic open, pitchy polling via rAF), and `'singing-result'` (scored; feedback visible). Legal transition chain: `'guessing' → 'singing-prompt' → 'singing-active' → 'singing-result' → 'revealed'`.
- Score sung input on: nearest named note, signed cents offset from the target (recorded to two decimal places), pitch-class match (within ±50 cents of the target), register match (correct octave via note-plus-octave model), and octave-error flag.
- Classify a likely second-harmonic octave error when the detected frequency is within 20 cents of either 2× the target frequency (sung pitch one octave too high) or ½× the target frequency (sung pitch one octave too low). A `'likely-octave-error'` verdict counts as a pitch-class match for accuracy reporting but increments the octave-error counter, not the correct-answer counter.
- Introduce `SUNG_CLARITY_THRESHOLD = 0.85` exported from `src/lib/audio/pitch-detection.svelte.ts`. Log an attempt as `'uncertain'` when measured pitchy clarity falls below this value. Uncertain attempts are stored in a separate local bucket and excluded from pitch-class accuracy percentages shown to the learner. This value differs deliberately from milestone 03's `CLARITY_THRESHOLD = 0.9` (the strict empirical spike gate); the lower production bar reduces uncertain-rejection rate on real voices.
- Microphone activation is explicit: the learner grants permission to start a sing-back drill and can revoke it at any time; permission state is persisted locally alongside other learner settings and is never transmitted to any server.
- The learner can complete every AP level without using the microphone; singing is an optional production branch and never gates AP level advancement.
- Present singing score alongside an explicit caveat that pitch production is bounded by vocal motor control, not only AP recall. A low singing score does not indicate failed AP learning. This distinction must appear in UI feedback copy for every verdict state.
- Add `RHYTHM_MIC_ENABLED = false` in `src/lib/feature-flags.ts`. Any rhythm-onset scoring entrypoint must guard behind this flag and return an explicit disabled error when called. Rhythm singing is out of scope until input-latency feasibility is measured on real devices.
- The singing feedback card displays a session summary after each sing-back round: the signed cents offset for this attempt alongside the rolling median cents offset across the last 10 stored sung attempts for this target pitch class (from `SUNG_ATTEMPTS_KEY` in `localStorage`). When fewer than 10 prior attempts exist, display only the current attempt's offset. This gives the learner a concrete improving signal without conflating vocal-motor skill with AP recall.

## User Experience Requirements

- The transition from `'singing-prompt'` to `'singing-active'` must occur synchronously inside the user-gesture handler (not deferred to a `$effect`, `onMount`, or any async callback that breaks gesture association) so `getUserMedia` and `AudioContext` activation remain in the same call stack. This mirrors the `getSynth()` discipline in `audio.ts`.
- Singing feedback distinguishes five states, each with distinct visible text (not color or needle position alone): "Wrong note", "Unclear signal — try again", "Correct pitch class", "Correct — right note and octave", and "Likely octave error".
- The visual pitch needle is `aria-hidden="true"`; a `role="status"` region (polite `aria-live`) carries the text verdict and updates only when the verdict changes, not on every animation frame, to avoid flooding assistive technology with rapid-fire updates.
- Microphone activation is clearly labelled ("Enable microphone"); disabling the mic mid-session is a single keyboard-reachable action that stops all `MediaStreamTrack` instances and returns the UI to `'singing-prompt'` state.
- When `getUserMedia` is unavailable or returns `NotAllowedError`, the drill degrades to listen-only mode with the keyboard answer surface from milestone 06; no singing-specific UI is shown and no `SungAttemptEvent` objects are recorded.
- Singing mode is reachable by keyboard alone. All interactive controls are Tab-reachable and operable with Enter and Space.
- The sing-back drill card renders inside the existing `+page.svelte` route—no new SvelteKit routes are introduced.
- Transfer-timbre and register naming context are consumed from milestone 07's singer-track infrastructure; no new timbre-separation training modes or register selection UI are introduced here.

## Data and Analytics Requirements

- Define `SungAttemptEvent` as a **standalone event type** in `src/lib/learning/drills/sung-attempt.ts`. It is stored separately from milestone 00's `AttemptEvent` flat type, because the two schemas are structurally incompatible: 00's union uses a flat shape with no `kind` discriminator, while `SungAttemptEvent` is a discriminated type with a different set of required fields. Merging would require a breaking schema refactor of 00's frozen type and would ripple into milestone 02's FSRS input. That refactor is out of scope here.

  ```typescript
  // src/lib/learning/drills/sung-attempt.ts
  export type SungAttemptEvent = {
  	readonly kind: 'sung-attempt';
  	readonly version: 1;
  	readonly sessionId: string;
  	readonly drillId: string;
  	readonly promptId: string;
  	readonly timestamp: number; // Date.now()
  	readonly targetPitch: Pitch;
  	readonly detectedFrequencyHz: number;
  	readonly nearestPitch: Pitch;
  	readonly centsOffset: number; // positive = sharp, negative = flat
  	readonly clarity: number; // 0–1 from pitchy
  	readonly detectedOctave: number;
  	readonly verdict: SungVerdict;
  	readonly uncertain: boolean; // clarity < SUNG_CLARITY_THRESHOLD
  };
  ```

- The five-state verdict union: `type SungVerdict = 'wrong' | 'uncertain' | 'correct-pitch-class' | 'correct-register' | 'likely-octave-error'`.
- Serialized `SungAttemptEvent` must contain none of the following field names: `buffer`, `blob`, `ArrayBuffer`, or `Float32Array`. No raw audio data is ever stored or transmitted.
- Sung attempts are stored under `SUNG_ATTEMPTS_KEY = 'vibratone:sung-attempts'` as a single append-only array via `saveSungAttempt` in `src/lib/persistence.ts`. The `uncertain` field is the discriminator; classification (uncertain bucket, octave-error counter) is computed at read time via `classifyAttempt`. **Do not use `appendAttemptEvent` or the `vibratone:attempts:v1` key from milestone 00—that store holds a different schema and must not be mixed with sung attempts.**
- Octave-error attempts increment a dedicated octave-error counter, not the wrong-answer counter. They also count as pitch-class matches for accuracy reporting.
- Permission state transitions (`'requesting'`, `'allowed'`, `'denied'`, `'revoked'`) are stored locally under `MIC_PERMISSION_KEY = 'vibratone:mic-permission'` using the same persistence layer as other learner settings. No permission event is sent to any server.
- Track the rolling median cents offset per pitch class across the last 10 `SungAttemptEvent` entries for that pitch class to surface a learner-visible improving signal. Computed at read time from `SUNG_ATTEMPTS_KEY`; never transmitted.

## Accessibility Requirements

- The pitch meter's visual needle is `aria-hidden="true"`. A `role="status"` region with a `.sr-only` positioning class carries the text verdict; the region updates only on verdict change, not on every animation frame, to prevent screen-reader flooding.
- Each of the five feedback states renders distinct visible text queryable by `getByText`; no state is communicated by CSS color class or SVG element alone.
- The mic permission button has an accessible name ("Enable microphone") and is keyboard-operable with Enter and Space. In the `'requesting'` state it uses `aria-disabled` (not `disabled`) so screen readers can still focus it.
- All interactive controls in the sing-back drill have visible focus rings and accessible names.
- The branch works without a pointing device; all AP rounds are completable via Tab and Enter navigation alone.
- The `microphone-permission.svelte` component (introduced in milestone 03) uses the canonical state text from milestone 03's ARIA spec: `'idle'` → "Microphone off", `'requesting'` → "Requesting microphone access…", `'allowed'` → "Microphone active", `'denied'` → "Microphone access denied. Allow access in browser settings.", `'unavailable'` → "Microphone is not available in this browser."

## Module and Architecture Targets

**The `MicPermission` union is inherited from milestone 03—do not redefine it.** `src/lib/audio/microphone.ts` (milestone 03) exports:

```typescript
export type MicPermission = 'idle' | 'requesting' | 'allowed' | 'denied' | 'unavailable';
```

This milestone imports and extends from that file only. No alias, no redefinition. A junior reading both milestone 03 and this file should find a single, consistent type.

**The `learning/` tree lives at `src/lib/learning/`** (established in milestone 00 as `src/lib/learning/drills/`). All new drill-schema files follow the same path prefix.

---

**New files introduced by this milestone:**

| File                                            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/audio/pitch-detection.svelte.ts`       | `createPitchDetector(analyser: AnalyserNode)` using `createSubscriber` from `svelte/reactivity` for the rAF poll loop; `PitchEstimate` type; `SUNG_CLARITY_THRESHOLD = 0.85`; `createPitchDetectorStub(frequency, clarity)` for unit tests                                                                                                                                                                                                                                                        |
| `src/lib/audio/pitch-scoring.ts`                | Pure: `frequencyToPitchScore(hz)`, `classifyOctaveError(detectedHz, targetHz, toleranceCents?)`, `scoreSungAttempt(score, target, clarity)` returning `SungVerdict`; stubs Octavian #33/#26 inline                                                                                                                                                                                                                                                                                                |
| `src/lib/audio/sung-attempt-serialization.ts`   | `serializeSungAttempt(event: SungAttemptEvent): string`; `classifyAttempt(event, buckets): AttemptBuckets`; `AttemptBuckets` type; `EMPTY_BUCKETS` constant                                                                                                                                                                                                                                                                                                                                       |
| `src/lib/components/mic-permission-gate.svelte` | Internal stub for Cinder #321; props: `permission: MicPermission`, `onrequest: () => void`, `children: Snippet`; keyboard-focusable "Enable microphone" button; `role="status"` for non-`'allowed'` states; swap to Cinder component when #321 ships                                                                                                                                                                                                                                              |
| `src/lib/components/pitch-meter.svelte`         | Internal stub for Cinder #324; props: `frequencyHz: number \| null`, `targetHz: number`, `centsOffset: number \| null`, `verdict: SungVerdict \| null`; needle is `aria-hidden="true"`, `role="status"` region carries text verdict; `visibility: hidden` when `frequencyHz` is null; needle maps `centsOffset` linearly from −50¢ → −60° to +50¢ → +60° (120° arc); exports `NEEDLE_MIN_CENTS`, `NEEDLE_MAX_CENTS`, `NEEDLE_MIN_DEG`, `NEEDLE_MAX_DEG`, `centsToRotationDeg` for test assertions |
| `src/lib/components/singing-card.svelte`        | Sing-back drill UI; wraps `<PracticeCard>` as outer layout container; composes `mic-permission-gate` and `pitch-meter`; renders each singing phase; accepts `SingingCardProps` (see below); the `fallback` snippet receives the existing keyboard answer surface for denied/unavailable states                                                                                                                                                                                                    |
| `src/lib/feature-flags.ts`                      | `RHYTHM_MIC_ENABLED = false`; `rhythmMicEntrypoint()` that returns a disabled error object (does not throw) when the flag is false                                                                                                                                                                                                                                                                                                                                                                |
| `src/lib/learning/drills/sung-attempt.ts`       | `SungAttemptEvent` type; `SungVerdict` union; `isValidSungAttemptEvent(value: unknown): value is SungAttemptEvent` type guard                                                                                                                                                                                                                                                                                                                                                                     |

**Modified files:**

| File                          | Change                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/state.svelte.ts`     | Extend `Phase` with `'singing-prompt' \| 'singing-active' \| 'singing-result'`; add `let activeMicSession: MicrophoneSession \| null` (plain `let`, not `$state`); add `startSinging()`, `submitSung(estimate)`, `dismissSingingResult()` action functions to factory return; extend `destroy()` to call `activeMicSession?.stop()` and `activeMicSession = null` |
| `src/lib/audio/microphone.ts` | Add `MicrophoneSession` type, `MicResult` discriminated union, and `requestMicrophone()` async helper as new named exports; existing `createMicrophoneState` exports in `microphone.svelte.ts` are untouched                                                                                                                                                      |
| `src/lib/audio.ts`            | Add `get context(): AudioContext` getter on `Synth` class so `requestMicrophone` can reuse the existing `AudioContext` without reaching into private fields                                                                                                                                                                                                       |
| `src/lib/persistence.ts`      | Add `SUNG_ATTEMPTS_KEY = 'vibratone:sung-attempts'` and `MIC_PERMISSION_KEY = 'vibratone:mic-permission'` storage keys; add `saveSungAttempt(storage, event)`, `saveMicPermission(storage, state)`, `loadMicPermission(storage)` helpers; add `isMicPermission(value: unknown): value is MicPermission` type guard with `'idle'` fallback for malformed values    |
| `src/routes/+page.svelte`     | Render `<SingingCard />` conditionally in singing phases; `onDestroy` already calls `state.destroy()` which now tears down the mic session                                                                                                                                                                                                                        |

**Key type contracts:**

```typescript
// src/lib/audio/pitch-scoring.ts
export type PitchScore = {
	nearestPitch: Pitch;
	centsOffset: number;
	detectedOctave: number;
};

export function frequencyToPitchScore(frequencyHz: number): PitchScore;

export function classifyOctaveError(
	detectedHz: number,
	targetHz: number,
	toleranceCents?: number // default: 20
): boolean;

/**
 * Evaluation order (short-circuit on first match):
 *   1. clarity < SUNG_CLARITY_THRESHOLD → 'uncertain'
 *   2. classifyOctaveError(pitchToFrequency(score.nearestPitch), pitchToFrequency(targetPitch)) → 'likely-octave-error'
 *   3. pitch-class match AND register match (same octave) → 'correct-register'
 *   4. pitch-class match only → 'correct-pitch-class'
 *   5. else → 'wrong'
 *
 * Octave-error is evaluated BEFORE pitch-class match, so a sung frequency
 * within 20 cents of 2× or ½× the target is always 'likely-octave-error'.
 * Note: `Pitch = { pc: PitchClass; octave: number }` — no `.frequency` field.
 * Always call `pitchToFrequency(pitch)` from `src/lib/music.ts` to convert.
 */
export function scoreSungAttempt(
	score: PitchScore,
	targetPitch: Pitch,
	clarity: number
): SungVerdict;

// src/lib/audio/pitch-detection.svelte.ts
export const SUNG_CLARITY_THRESHOLD = 0.85;

// Distinct from milestone 03's CLARITY_THRESHOLD = 0.9 (strict spike gate).
// The lower production bar reduces uncertain-rejection rate on real voices.

export type PitchEstimate = {
	readonly frequencyHz: number | null; // null when clarity < SUNG_CLARITY_THRESHOLD
	readonly clarity: number;
};

export type PitchDetector = {
	detect(samples: Float32Array): PitchEstimate;
};

export function createPitchDetectorStub(frequency: number | null, clarity: number): PitchDetector;

// src/lib/components/singing-card.svelte — SingingCardProps
import type { Snippet } from 'svelte';
import type { Pitch } from '$lib/music.ts';
import type { MicPermission } from '$lib/audio/microphone.ts';
import type { SungVerdict } from '$lib/learning/drills/sung-attempt.ts';
import type { PitchEstimate } from '$lib/audio/pitch-detection.svelte.ts';

type SingingPhase = 'singing-prompt' | 'singing-active' | 'singing-result';

type SingingCardProps = {
	targetPitch: Pitch;
	phase: SingingPhase;
	micPermission: MicPermission;
	estimate: PitchEstimate | null;
	verdict: SungVerdict | null;
	centsOffset: number | null;
	rollingMedianCentsOffset: number | null; // null when < 10 stored attempts
	onstartSinging: () => Promise<void>;
	ondisableMic: () => void;
	ondismissResult: () => void;
	fallback?: Snippet;
};

// src/lib/audio/sung-attempt-serialization.ts
export type AttemptBuckets = {
	pitchClass: SungAttemptEvent[];
	uncertain: SungAttemptEvent[];
	octaveError: SungAttemptEvent[];
	wrong: SungAttemptEvent[];
};

export const EMPTY_BUCKETS: AttemptBuckets;

export function serializeSungAttempt(event: SungAttemptEvent): string;
export function classifyAttempt(event: SungAttemptEvent, buckets: AttemptBuckets): AttemptBuckets;
```

**State action functions added to `createPracticeState()` in `src/lib/state.svelte.ts`:**

```typescript
// Called synchronously inside an onclick handler (gesture-gated)
async function startSinging(): Promise<void>;

// Called when pitchy produces a stable estimate above the clarity threshold
function submitSung(estimate: PitchEstimate): void;

// Called to dismiss the result and return to 'revealed' (then auto-advance)
function dismissSingingResult(): void;
```

These three functions join the factory return object alongside the existing `play`, `guess`, `nextRound`, `replay`, and `destroy` actions.

**The rAF polling loop** inside `createPitchDetector` runs as plain JS and writes only two scalars (`frequencyHz` and `clarity`) into `$state`. `Float32Array` analysis buffers are module-private `let` variables—never passed to `$state`. The `createSubscriber` callback from `svelte/reactivity` bridges the loop to Svelte reactivity: the loop calls `update()`, triggering subscribing `$derived` or `$effect` blocks. The loop must guard `requestAnimationFrame` with `typeof window !== 'undefined'`. The factory itself is instantiated only inside `startSinging()` (never at module scope or during SSR).

**SSR safety:** Every module touching `getUserMedia`, `navigator.permissions`, `AnalyserNode`, or `requestAnimationFrame` guards at the call site. The factory import itself may run during SSR; all browser API access is deferred behind the gesture trigger or a `typeof window === 'undefined'` check. Mirrors the `audio.ts` discipline.

**`requestMicrophone`, `MicrophoneSession`, and `MicResult`** are NEW exports that this milestone adds to `src/lib/audio/microphone.ts`, alongside—but without replacing—the stateful `createMicrophoneState()` factory that milestone 03 ships in `microphone.svelte.ts`. Milestone 03 does not define these; a junior reading milestone 03 will not find them. This milestone adds them.

```typescript
// NEW in src/lib/audio/microphone.ts (added by milestone 08):
export type MicrophoneSession = {
	readonly stream: MediaStream;
	stop(): void;
};

export type MicResult =
	| { readonly ok: true; readonly session: MicrophoneSession }
	| { readonly ok: false; readonly reason: 'denied' | 'unavailable' | 'unknown' };

/** One-shot async helper: requests mic access and returns a typed result. */
export async function requestMicrophone(): Promise<MicResult>;
```

The boundary: `microphone.ts` owns pure helpers and this one-shot async helper; `microphone.svelte.ts` owns the full stateful factory for the spike route. The singing card calls `requestMicrophone()` and holds the returned session reference inside `createPracticeState`—never reaching into `createMicrophoneState()`'s internals.

## Dependencies

- **Milestone 07** (Functional and Singer Tracks): provides the singer-track singing/pitch-input drill patterns and the sung-attempt feedback vocabulary (note, cents, clarity) that `SungVerdict` extends. Also provides the note-plus-octave model from which `'correct-register'` derives its octave comparison—specifically, the `Pitch.octave` field from `src/lib/music.ts` that milestone 07's singer track exercises.

- **Milestone 03** (Microphone Pitch-Detection Spike): provides `src/lib/audio/microphone.ts` with the canonical `MicPermission` union (`'idle' | 'requesting' | 'allowed' | 'denied' | 'unavailable'`), `MicrophoneState` factory, `CLARITY_THRESHOLD = 0.9`, `detectPitch` wrapper, `frequencyToNoteName`, `frequencyToCents`, `isOctaveError`, and `scorePitchEstimate` pure helpers. Also establishes the `createSubscriber` rAF loop discipline and the gesture-gated `getUserMedia` pattern. **Milestone 08 imports from milestone 03's module—it does not duplicate or shadow any of these exports.**

  **Milestone 08 cannot start until milestone 03 is merged AND `docs/spikes/microphone-feasibility.md` records a GO verdict.**
  - If milestone 03 recorded **GO**: proceed. All singing-specific code in this milestone may be authored and reviewed.
  - If milestone 03 recorded **NO-GO**: this milestone is deferred in full per milestone 03's NO-GO rule. Open a follow-up issue (`gh issue create` against the Vibratone repository) scoped to the specific failing metric before any singing-specific code is written. The rest of the roadmap is unaffected.

## External Dependency Contracts

| Capability                                              | Owner                                               | Ticket                                                   | Contract used in this milestone                                                                                                                                                                                                                                                           | Stub/mock plan                                                                                                                                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pitchy` McLeod pitch method                            | npm (third-party)                                   | None — install `bun add pitchy` when milestone 08 begins | `PitchDetector.forFloat32Array(bufferSize)` → `detector.findPitch(buffer: Float32Array, sampleRate: number): [frequency: number, clarity: number]`. Wrapped inside `detectPitch` in `src/lib/audio/microphone.ts` (milestone 03). Milestone 08 calls `detectPitch`, never pitchy directly | `createPitchDetectorStub(frequency, clarity)` returns a deterministic `PitchDetector`; all unit tests use the stub; real pitchy runs only in Playwright e2e with `--use-fake-device-for-media-stream`                 |
| Frequency-to-note scoring                               | Octavian                                            | [#33](https://github.com/stevekinney/octavian/issues/33) | `(hz: number) => { pitch: Pitch; centsOffset: number }` — nearest MIDI note and signed cents deviation                                                                                                                                                                                    | Implement `frequencyToPitchScore` inline in `src/lib/audio/pitch-scoring.ts` using `Math.round(69 + 12 * Math.log2(hz / 440))` and `SHARP_NAMES` from `src/lib/music.ts`; replace with Octavian export when #33 ships |
| Cents-from-frequencies                                  | Octavian                                            | [#26](https://github.com/stevekinney/octavian/issues/26) | `centsFromFrequencies(detected: number, reference: number): number`                                                                                                                                                                                                                       | Inline `1200 * Math.log2(detected / reference)` in `src/lib/audio/pitch-scoring.ts`; drop-in replaceable when #26 ships                                                                                               |
| Cinder permission gate                                  | Cinder                                              | [#321](https://github.com/stevekinney/cinder/issues/321) | `<PermissionGate permission={MicPermission} onrequest={() => void} children={Snippet} />` rendering children only when `'allowed'`, otherwise accessible status text                                                                                                                      | `src/lib/components/mic-permission-gate.svelte` built in-house; prop interface must match #321 spec for one-line import swap                                                                                          |
| Cinder signal visualization                             | Cinder                                              | [#324](https://github.com/stevekinney/cinder/issues/324) | `<PitchMeter frequencyHz centsOffset verdict targetHz />` with `aria-hidden` needle and `role="status"` text region                                                                                                                                                                       | `src/lib/components/pitch-meter.svelte` built in-house; swap when #324 ships                                                                                                                                          |
| `requestMicrophone` / `MicResult` / `MicrophoneSession` | `src/lib/audio/microphone.ts` (internal, NEW in 08) | N/A                                                      | `requestMicrophone(): Promise<MicResult>` where `MicResult` is `{ ok: true; session: MicrophoneSession } \| { ok: false; reason: 'denied' \| 'unavailable' \| 'unknown' }`                                                                                                                | No stub—implemented directly in `microphone.ts` by this milestone; unit-tested with `vi.stubGlobal('navigator', …)`                                                                                                   |
| `Synth.context` getter                                  | `src/lib/audio.ts` (internal, NEW in 08)            | N/A                                                      | `get context(): AudioContext` on `Synth` class                                                                                                                                                                                                                                            | No stub needed—add the getter to `audio.ts` in this milestone                                                                                                                                                         |

## Acceptance Criteria

- **AC-0:** `docs/spikes/microphone-feasibility.md` exists, is committed, and records a GO verdict before any singing-specific code in this milestone is authored or reviewed.
- **AC-1:** Given a sing-back prompt for A4, when the learner sings within ±50 cents of A4 (440 Hz) with clarity ≥ 0.85, the result verdict is `'correct-pitch-class'` or `'correct-register'` and the signed cents offset is recorded to two decimal places.
- **AC-2:** Given a sing-back prompt for A4, when the detected frequency is within 20 cents of 880 Hz (A4 × 2), the verdict is `'likely-octave-error'`—not `'wrong'` or `'correct-pitch-class'`.
- **AC-3:** Given a sing-back prompt for A4, when the detected frequency is within 20 cents of 220 Hz (A4 ÷ 2), the verdict is `'likely-octave-error'`.
- **AC-4:** When measured pitchy clarity is below 0.85, the attempt verdict is `'uncertain'`; the attempt is stored in the `SUNG_ATTEMPTS_KEY` array with `uncertain: true`; the pitch-class accuracy counter is not incremented.
- **AC-5:** When the learner navigates away from a sing-back drill, all `MediaStreamTrack` instances have `readyState === 'ended'` before the next route mounts. Verified by injecting a track-stop spy.
- **AC-6:** When the learner declines mic permission, the sing-back drill shows accessible fallback copy and the AP level continues to accept keyboard answers normally; no singing-specific pitch meter or verdict UI is visible.
- **AC-7:** Singing score is never used as a gate on AP level advancement. A learner with zero singing attempts can still complete every AP level.
- **AC-8:** The pitch meter displays a numeric verdict text (e.g., "+12 cents — Correct pitch class") alongside the visual needle. The text lives in a `role="status"` region; the needle element has `aria-hidden="true"`.
- **AC-9:** The permission state is read from and written to `MIC_PERMISSION_KEY` in `localStorage` only. No permission event is transmitted to any server. Verified by Playwright `page.on('request')` assertion during both allow and deny flows.
- **AC-10:** `RHYTHM_MIC_ENABLED` is `false`. Calling the rhythm-scoring entrypoint when `RHYTHM_MIC_ENABLED` is `false` returns an explicit disabled error object without throwing an unhandled exception.
- **AC-11:** A serialized `SungAttemptEvent` JSON string contains none of the field names `buffer`, `blob`, `ArrayBuffer`, or `Float32Array`.
- **AC-12:** After 10 or more stored sung attempts for a given pitch class (keyed from `SUNG_ATTEMPTS_KEY`), the feedback card renders both the single-attempt cents offset and the rolling median cents offset. With fewer than 10 stored attempts, only the single-attempt offset is rendered. The median is computed locally and never transmitted to any server.

## Test Plan

### Unit tests — `src/lib/audio/pitch-scoring.spec.ts`

- `frequencyToPitchScore(440) returns nearestPitch A4 with centsOffset 0`
- `frequencyToPitchScore(466.16) returns nearestPitch A♯4 with centsOffset approximately 0` (466.16 Hz is A♯4 in equal temperament; this is not "+100 cents")
- `frequencyToPitchScore(220) returns nearestPitch A3 with centsOffset 0`
- `frequencyToPitchScore: centsOffset is expressed to at most two decimal places`
- `classifyOctaveError(880, 440) returns true (detected is target × 2)`
- `classifyOctaveError(220, 440) returns true (detected is target ÷ 2)`
- `classifyOctaveError(441, 440) returns false (within unison, not octave error)`
- `classifyOctaveError(880, 440, 20) returns true when within 20-cent tolerance`
- `classifyOctaveError: a two-octave difference (110 Hz vs 440 Hz) returns false — outside the ±1-octave window`
- `scoreSungAttempt with clarity 0.84 returns verdict "uncertain"`
- `scoreSungAttempt with clarity 0.85 and correct pitch class and octave returns "correct-register"`
- `scoreSungAttempt with clarity 0.85 and ~860 Hz against A4 (same pitch class, >20 cents from clean octave at 880 Hz) returns "correct-pitch-class"`
- `scoreSungAttempt with clarity 0.85 and 880 Hz against A4 (within 20 cents of A4 × 2) returns "likely-octave-error"`
- `scoreSungAttempt with wrong pitch class returns "wrong"`
- `scoreSungAttempt: likely-octave-error verdict is counted as a pitch-class match for accuracy reporting, not as wrong`

### Unit tests — `src/lib/audio/pitch-detection.spec.ts`

- `createPitchDetectorStub(440, 0.9).detect(samples) returns { frequencyHz: 440, clarity: 0.9 }`
- `createPitchDetectorStub(null, 0.3).detect(samples) returns { frequencyHz: null, clarity: 0.3 }`
- `SUNG_CLARITY_THRESHOLD is 0.85`
- `createPitchDetector: the RAF loop is cancelled (cancelAnimationFrame called) when the detector's cleanup function is invoked` (spy on `cancelAnimationFrame` via `vi.stubGlobal`)
- `createPitchDetector: detect() returns null after the cleanup function runs`

### Unit tests — `src/lib/audio/microphone.spec.ts` (additions for this milestone)

- `requestMicrophone: calls getUserMedia with { audio: true }` (no video constraint)
- `requestMicrophone: returns { ok: true, session } when getUserMedia resolves`
- `requestMicrophone: returns { ok: false, reason: "denied" } when getUserMedia rejects with NotAllowedError`
- `requestMicrophone: returns { ok: false, reason: "unavailable" } when getUserMedia rejects with NotFoundError`
- `requestMicrophone: session.stop() calls track.stop() on every MediaStreamTrack`
- `requestMicrophone: session.stop() is idempotent when called twice`
- `microphone.svelte.ts: does not invoke requestMicrophone() or getUserMedia from an onMount or $effect block` (reads `microphone.svelte.ts` as a string; asserts no match for `/onMount[\s\S]*?requestMicrophone|[$]effect[\s\S]*?requestMicrophone/`)

### Unit tests — `src/lib/learning/drills/sung-attempt.spec.ts`

- `isValidSungAttemptEvent accepts a well-formed SungAttemptEvent`
- `isValidSungAttemptEvent rejects an object missing centsOffset`
- `isValidSungAttemptEvent rejects an object with verdict not in the SungVerdict union`
- `SungAttemptEvent with uncertain: true always has clarity < 0.85`

### Unit tests — `src/lib/audio/sung-attempt-serialization.spec.ts`

- `serializeSungAttempt: serialized JSON contains no field named "buffer", "blob", "ArrayBuffer", or "Float32Array"`
- `serializeSungAttempt: includes exactly the required SungAttemptEvent fields`
- `classifyAttempt: uncertain attempts land in the uncertain bucket, not the wrong bucket`
- `classifyAttempt: likely-octave-error verdict increments octaveError counter AND counts as pitchClass match, not wrong`
- `classifyAttempt: only attempts with clarity ≥ 0.85 contribute to pitch-class accuracy`

### Unit tests — `src/lib/feature-flags.spec.ts`

- `RHYTHM_MIC_ENABLED is false in the current build`
- `rhythmMicEntrypoint: returns an explicit disabled error when RHYTHM_MIC_ENABLED is false`

### Unit tests — `src/lib/persistence.spec.ts` (additions for this milestone)

- `isMicPermission: accepts all five valid permission strings — idle, requesting, allowed, denied, unavailable`
- `isMicPermission: rejects an arbitrary string not in the MicPermission union`
- `loadMicPermission: returns "idle" fallback when MIC_PERMISSION_KEY is missing from localStorage`
- `loadMicPermission: returns "idle" fallback when the stored value is not a valid MicPermission string`
- `saveMicPermission then loadMicPermission: round-trips the allowed state`
- `saveMicPermission then loadMicPermission: round-trips the denied state`
- `saveSungAttempt: appends to SUNG_ATTEMPTS_KEY without overwriting prior entries`

### Unit tests — `src/lib/state.svelte.spec.ts` (additions for this milestone)

- `destroy(): calls session.stop() when a mic session is active`
- `destroy(): does not throw when no mic session is active`
- `destroy(): sets activeMicSession to null after stopping`
- `singing phase transitions: guessing → singing-prompt sets phase to "singing-prompt"`
- `singing phase transitions: singing-prompt → singing-active sets phase to "singing-active"`
- `singing phase transitions: singing-active → singing-result sets phase to "singing-result" and records the verdict`
- `singing phase transitions: singing-result → revealed advances to revealed and resets singing state`
- `illegal transition: calling startSinging() when phase is not "singing-prompt" is a no-op`
- `illegal transition: calling submitSung() when phase is not "singing-active" is a no-op`

### Component tests — `src/lib/components/mic-permission-gate.svelte.test.ts`

- `MicPermissionGate: renders a button with accessible name "Enable microphone" in idle state`
- `MicPermissionGate: button is operable with Enter key in idle state`
- `MicPermissionGate: button is operable with Space key in idle state`
- `MicPermissionGate: renders role="status" with text "Microphone access denied" in denied state`
- `MicPermissionGate: renders role="status" with text "Microphone not available" in unavailable state`
- `MicPermissionGate: renders slot content only when permission is "allowed"`
- `MicPermissionGate: "Disable microphone" toggle is keyboard-reachable and has an accessible name`

### Component tests — `src/lib/components/pitch-meter.svelte.test.ts`

- `PitchMeter: has a role="status" region`
- `PitchMeter: renders verdict text in the role="status" region, not only as needle position`
- `PitchMeter: renders "Listening…" text when frequencyHz is null`
- `PitchMeter: renders note name and cent offset text when a pitch is detected above clarity threshold`
- `PitchMeter: renders "Unclear signal" text when verdict is "uncertain"`
- `PitchMeter: needle element has aria-hidden="true"`
- `PitchMeter: role="status" region textContent does not change when frequencyHz updates but verdict remains the same`
- `PitchMeter: role="status" region textContent updates when verdict changes`
- `PitchMeter: centsToRotationDeg(0) returns 0`
- `PitchMeter: centsToRotationDeg(-50) returns NEEDLE_MIN_DEG`
- `PitchMeter: centsToRotationDeg(50) returns NEEDLE_MAX_DEG`

### Component tests — `src/lib/components/singing-card.svelte.test.ts`

- `SingingCard: renders prompt note name as visible text in singing-prompt phase`
- `SingingCard: shows mic activation button in singing-prompt phase`
- `SingingCard: shows pitch meter in singing-active phase`
- `SingingCard: shows verdict text in singing-result phase`
- `SingingCard: renders "Wrong note" text when verdict is "wrong"`
- `SingingCard: renders "Unclear signal — try again" text when verdict is "uncertain"`
- `SingingCard: renders "Correct pitch class" text when verdict is "correct-pitch-class"`
- `SingingCard: renders "Correct — right note and octave" text when verdict is "correct-register"`
- `SingingCard: renders "Likely octave error" text when verdict is "likely-octave-error"`
- `SingingCard: all five verdict states render within a role="status" element`
- `SingingCard: shows AP motor-control caveat copy alongside singing result`
- `SingingCard: does not advance AP level on any singing result`
- `SingingCard: mic button is keyboard-accessible with visible focus ring`
- `SingingCard: the transition from singing-prompt to singing-active is initiated synchronously in the click handler, not inside a $effect or onMount`
- `SingingCard: shows rolling median cents offset when 10 or more attempts exist for the target pitch class`
- `SingingCard: shows only single-attempt cents offset when fewer than 10 prior attempts exist`

### Playwright e2e — `e2e/singing-mic-allow.spec.ts`

Setup: `context.grantPermissions(['microphone'])`, browser launched with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`.

- `mic allow: permission gate button is visible and keyboard-focusable before mic is activated`
- `mic allow: activating mic transitions UI to singing-active phase`
- `mic allow: pitch meter role="status" region is present and non-empty after mic activation`
- `mic allow: the learner can submit a singing attempt and see one of the five verdict text states`
- `mic allow: feedback text is visible (not exclusively color- or icon-coded)`
- `mic allow — privacy: no outbound network requests are issued during a complete singing-active → singing-result flow` (`page.on('request')` listener asserts zero qualifying requests)

### Playwright e2e — `e2e/singing-mic-deny.spec.ts`

Setup: no microphone permission granted.

- `mic deny: "Microphone access denied" status is rendered accessibly after denial`
- `mic deny: keyboard answer surface is shown — AP training is usable without mic`
- `mic deny: no singing-specific pitch meter or verdict UI is shown`
- `mic deny: learner can complete a full AP round using keyboard-only controls`
- `mic deny — privacy: no outbound network requests carry microphone permission state, detected frequency, or clarity data` (`page.on('request')` listener asserts zero qualifying requests)

### Playwright e2e — `e2e/singing-mic-cleanup.spec.ts`

Setup: `context.grantPermissions(['microphone'])`, fake device.

- `mic cleanup — route navigation: navigating away from singing drill stops all MediaStream tracks (track.readyState === "ended" verified via page.evaluate)`
- `mic cleanup — toggle off: clicking "Disable microphone" stops all tracks and returns UI to idle state`
- `mic cleanup — toggle reversibility: after disabling, the learner can re-enable mic via the permission gate button`
- `mic cleanup — SvelteKit navigation: client-side navigation that unmounts the component stops all tracks`

### Playwright e2e — `e2e/keyboard-only-singing-path.spec.ts`

- `keyboard-only: all interactive controls are reachable by Tab navigation alone`
- `keyboard-only: permission gate button is the first focusable element in the singing section`
- `keyboard-only: answer chips are operable by Enter and Space`
- `keyboard-only: feedback text is announced in a role="status" region after answer submission`
- `keyboard-only: learner can complete five consecutive AP rounds without using a mouse`

### Playwright e2e — `e2e/singing-responsive.spec.ts`

- `singing responsive — phone (390×844): pitch meter and feedback text visible without overflow`
- `singing responsive — phone (390×844): mic permission button within visible viewport without horizontal scroll`
- `singing responsive — tablet (768×1024): singing feedback card and AP score panel simultaneously visible`
- `singing responsive — tablet (768×1024): pitch meter text alternative present`
- `singing responsive — desktop (1280×800): all five verdict text states can be triggered and are readable`

### Acceptance criterion coverage map

| Acceptance criterion                            | Named tests                                                                                                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-0 GO/NO-GO gate                              | Milestone 03 completion signal + `docs/spikes/microphone-feasibility.md` commit check                                                                                         |
| AC-1 pitch-class match ±50¢, two decimal places | `pitch-scoring.spec: correct register`; `pitch-scoring.spec: centsOffset to two decimal places`                                                                               |
| AC-2 octave-error 2× target                     | `pitch-scoring.spec: classifyOctaveError(880, 440)`; `singing-mic-allow: sees one of five verdict states`                                                                     |
| AC-3 octave-error ÷2 target                     | `pitch-scoring.spec: classifyOctaveError(220, 440)`                                                                                                                           |
| AC-4 uncertain below 0.85                       | `pitch-scoring.spec: clarity 0.84 → uncertain`; `pitch-meter: renders "Unclear signal"`; `sung-attempt-serialization: uncertain in separate bucket`                           |
| AC-5 stream stops on navigate                   | `singing-mic-cleanup: route navigation test`; `microphone.spec: session.stop() calls track.stop()`                                                                            |
| AC-6 denied mic shows fallback                  | `singing-mic-deny: keyboard answer surface shown`; `mic-permission-gate: denied state renders accessible text`                                                                |
| AC-7 singing never gates AP                     | `SingingCard: does not advance AP level on any singing result`                                                                                                                |
| AC-8 accessible numeric readout                 | `pitch-meter: role="status" region present`; `singing-responsive: text alternative present at all widths`                                                                     |
| AC-9 permission stored locally, not transmitted | `persistence.spec: saveMicPermission writes to MIC_PERMISSION_KEY`; `singing-mic-allow: no outbound requests`; `singing-mic-deny: no outbound requests carry permission data` |
| AC-10 RHYTHM_MIC_ENABLED false                  | `feature-flags.spec: flag is false`; `feature-flags.spec: entrypoint returns disabled error`                                                                                  |
| AC-11 no raw audio in serialized event          | `sung-attempt-serialization: no buffer/blob/ArrayBuffer/Float32Array field names`                                                                                             |
| AC-12 rolling median display                    | `SingingCard: shows rolling median when ≥ 10 attempts`; `SingingCard: shows only single-attempt when < 10 attempts`                                                           |

## Verification

```sh
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

**Manual smoke (documented checklist, not a CI gate):**

- Chrome (latest, macOS): sing-back drill with real microphone; confirm pitch meter needle and verdict text both respond; confirm mic stops when navigating away.
- Safari (latest, macOS): same as Chrome smoke; confirm `getUserMedia` gesture-association behavior is intact; confirm `AudioContext` is resumed from a user gesture and not from a `$effect`.
- Phone browser (390px viewport): confirm sing-back card does not overflow; confirm pitch meter numeric readout is visible without horizontal scroll.

**Responsive Playwright smoke** (automated, part of `test:e2e`): `e2e/singing-responsive.spec.ts` covers 390px, 768px, and 1280px viewports.

## Non-Goals

- Do not use singing score as a gate on AP level advancement.
- Do not store or transmit raw microphone audio at any point.
- Do not transmit microphone permission events, sung frequency data, or clarity readings to any server in this milestone.
- Do not add rhythm onset scoring; `RHYTHM_MIC_ENABLED = false` enforces this in code.
- Do not guarantee singing accuracy on every device or room environment; state this caveat in learner-facing copy.
- Do not add cloud analysis or AI singing feedback in this milestone.
- Do not conflate a low singing score with failed AP recall; feedback copy must make the vocal-motor-control distinction explicit.
- Do not introduce new SvelteKit routes; the singing drill card renders inside the existing `+page.svelte`.
- Do not build trained-vs-transfer timbre analytics separation or register training mode selection—those are milestone 07 deliverables consumed here, not introduced here.
- Do not add scale-degree singing or relative-pitch context singing; these belong to milestone 11 (Relative Pitch and Singer Track), which introduces the Relative Pitch track as a separate path from AP training.
- Do not redefine `MicPermission` or shadow any export from `src/lib/audio/microphone.ts` established by milestone 03. Import only.
- Do not replace `createMicrophoneState()` from milestone 03's `microphone.svelte.ts`; that factory serves the spike route and lives alongside the production helpers.

## Completion Signal

This milestone is complete when:

1. `docs/spikes/microphone-feasibility.md` is committed and records a GO verdict (AC-0 prerequisite).
2. `bun run check`, `bun run lint`, `bun run test:unit -- --run`, and `bun run test:e2e` all pass.
3. All named unit tests, component tests, and Playwright specs in the Test Plan exist and pass.
4. A learner can hear a named pitch, sing or hum it back into a microphone, and receive an honest score (pitch-class match, signed cents offset, octave-error classification, and vocal-motor caveat copy).
5. The rolling median cents offset surfaces after 10 or more sung attempts for a given pitch class.
6. Learners who decline or cannot use a microphone can complete the full AP path via keyboard answer surfaces without encountering any mic-dependent state.
7. No `SungAttemptEvent` serialization includes a field named `buffer`, `blob`, `ArrayBuffer`, or `Float32Array`.
8. `RHYTHM_MIC_ENABLED` is `false` and the guarded entrypoint returns a disabled error without throwing.
