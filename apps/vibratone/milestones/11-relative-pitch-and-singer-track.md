# 11. Relative Pitch and Singer Track

## Outcome

Any learner—including those who cannot or will not use a microphone—can start a Relative Pitch track without AP placement, configure tonal context (drone, cadence, both, or neither), identify scale degrees in major and natural minor using any non-mic answer mode (movable-do, fixed-do, letter name, scale-degree number), and have their RP progress tracked in complete isolation from AP analytics.

Learners who grant microphone permission can additionally sing scale degrees and receive scored feedback. This branch reuses the productionized mic runtime shipped in M04 (Transfer, Register, and Singing): `requestMicrophone`, `MicrophoneSession`, `createPitchDetector`, `frequencyToPitchScore`, `mic-permission-gate.svelte`, and `pitch-meter.svelte` from `src/lib/audio/` and `src/lib/components/`. Because the feasibility question was resolved upstream (the GO/NO-GO decision in `docs/spikes/microphone-feasibility.md`), this milestone does not re-evaluate it. The graceful-degradation case—when the user declines permission or mic is unavailable—falls back to keyboard answer surfaces with no mic-specific UI shown and no sung-attempt events recorded.

## Product Requirements

- Add the Relative Pitch track as a separate, independent path. Learners must never be required to complete or start AP placement to access RP training.
- Add tonal context configuration: drone only, cadence only, both, or neither. The choice persists across sessions.
- Add scale-degree identification in major and natural minor across degrees 1–7. At minimum, C major and A natural minor must be available; at least one of each mode is required at milestone close.
- Add four non-mic answer modes: movable-do solfege, fixed-do solfege, letter name, and scale-degree number. Each mode must canonicalize to a pitch class for scoring.
- Add scale-degree singing (mic-gated): establish the key, then sing the requested degree. Singing is **octave-agnostic**—any register that matches the correct degree is credited. This differs deliberately from AP sing-back, which scores register and classifies octave errors.
- Add pocket mode: after pressing Start, the learner closes their eyes and receives spoken answers after a configurable delay. No visual interaction is required after Start.
- Keep AP and RP progress strictly separate. Every RP attempt event carries `track: 'relative-pitch'`; every AP event carries `track: 'absolute-pitch'`. Analytics aggregations filter by track.
- The app must explain in visible UI copy that relative-pitch training serves a different goal from AP training. No UI string may contain "perfect pitch", "guaranteed", or "will learn."

## User Experience Requirements

- The Relative Pitch track entry point is visible on first visit without any AP history.
- Choosing the RP track does not start the AP track, and vice versa. AP and RP entry points are distinct on the same page.
- Tonal context (drone/cadence/both/none) is configurable before and during sessions.
- When drone is enabled, a continuous tonic drone plays throughout the answer window. It must survive the `play()` call for the prompt note—the drone gain node is independent of the synth voice pool.
- When cadence is enabled, a four-chord cadence (I–IV–V–I for major, i–iv–V–i for natural minor) plays before the prompt tone.
- Singing feedback does not rely solely on the visual pitch meter: each verdict state (`'wrong-degree'`, `'correct-degree'`, `'uncertain'`) renders distinct visible text queryable by `getByText`.
- Pocket mode:
  - After pressing Start, a full prompt-answer-feedback cycle completes with zero pointer events.
  - The spoken-answer delay is configurable (default 3 seconds, range 1–10 seconds) and stored in learner settings.
  - If `window.speechSynthesis` is unavailable, the answer appears visually after the same delay and the learner is informed once per session: "Text-to-speech is not available in this browser. Visual answers shown instead."
  - `speechSynthesis.cancel()` is called in the component's teardown to avoid leaked utterances on navigation.
- The app renders without horizontal overflow at 390×844 (phone), 768×1024 (tablet), and 1280×800 (desktop).

## Data and Analytics Requirements

- Every RP attempt event is a `RelativePitchAttemptEvent` with `track: 'relative-pitch'` as a required field. The AP analytics aggregation (`computeApAnalytics`) excludes events where `track !== 'absolute-pitch'`.
- RP FSRS cards are stored under a distinct namespace (`rp::<key>::<degree>::<mode>::<answerMode>`) that does not overlap with AP card keys (`ap::<pitchClass>`).
- Attempt events must record: `key` (tonic pitch class), `mode` ('major' | 'natural-minor'), `tonicSetup` ('drone' | 'cadence' | 'both' | 'none'), `targetDegree` (1–7), `answerMode` ('movable-do' | 'fixed-do' | 'letter-name' | 'scale-degree' | 'microphone'), `answer`, `correctAnswer`, `scaleDegreeCorrect`, `responseTimeMs`, `sessionId`, `drillId`, `timestamp`.
- When `answerMode === 'microphone'`: additionally record `detectedNote`, `centsOffset`, `clarity`, and `verdict` (`ScaleDegreeSungVerdict`). No `AudioBuffer`, `Float32Array`, `MediaStream`, or raw frequency array may enter any storage key or network surface.
- RP progress (last session timestamp, due card count) is written to `localStorage` under namespaced keys (`vibratone:rp-settings`, `vibratone:rp-session-score`, `vibratone:rp-all-time-score`) so the Today surface (milestone 19) can read it without importing the RP Svelte context.
- No data is transmitted to any server. No database is required.

## Accessibility Requirements

- Pocket mode Start/Stop controls are `<button>` elements with `aria-pressed` and accessible names. They are Tab-reachable and operable with Enter and Space from any drill state.
- The pocket-mode spoken-answer delay countdown (if shown) must be suppressible by pressing any key. It must not create a screen-reader interrupt pattern; use `aria-live="polite"`, not `aria-live="assertive"`, for informational updates.
- The drone toggle is a `<button aria-pressed={droneActive}>` that starts/stops audio synchronously in the click handler (preserving the browser's gesture association with the `AudioContext`).
- Cadence playback completion is announced via a `role="status"` region ("Key established: C major") before the prompt tone sounds.
- Scale-degree answer buttons expose `aria-pressed` for the currently selected answer and `aria-disabled` when the phase is not 'guessing'.
- Singing feedback does not rely on color or needle position alone: each of the three `ScaleDegreeSungVerdict` states renders distinct visible text queryable by `getByText`.
- Drone and cadence setup controls must not trap focus. Tab must move past the setup group to the next control.
- Drone/cadence setup controls communicate state via `aria-checked` or `aria-pressed`, not color alone.
- The visual pitch needle from `pitch-meter.svelte` is `aria-hidden="true"`; the `role="status"` text region carries the verdict.

## Module and Architecture Targets

All new files follow the established conventions: `src/lib/learning/` for drill schemas and protocols; factory functions (never module-level `$state`) for SSR safety; `browser` from `$app/environment` for runtime guards.

| File                                           | Action     | What lands there                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/learning/drills/rp-attempt.ts`        | **Create** | `RelativePitchAttemptEvent` type, `ScaleDegreeSungVerdict` union, `RpAnswerMode` type, `TonicSetup` type, `isValidRelativePitchAttemptEvent` type guard                                                                                                                                                                                                                                                                                                                                                                        |
| `src/lib/learning/drills/schema.ts`            | **Modify** | Bump `AttemptEvent.version` to `2`; add `track: 'absolute-pitch' \| 'relative-pitch' \| 'theory' \| 'production'` as a required field on the base shape; add `isRelativePitchAttempt(e: AttemptEvent)` type guard; extend the `AttemptEvent` union with `RelativePitchAttemptEvent`                                                                                                                                                                                                                                            |
| `src/lib/learning/protocols/relative-pitch.ts` | **Create** | RP track rules: `generateRpPrompt(config: RpDrillConfig): RpPrompt`; `scaleDegreeLabel(degree, mode, tonicPc)` lookup table for all four answer modes; `isScaleDegreeCorrect(answeredPc, tonicPc, targetDegree, mode)` pure function; `RpDrillConfig` and `RpPrompt` types                                                                                                                                                                                                                                                     |
| `src/lib/learning/analytics/rp-summary.ts`     | **Create** | `getRelativePitchSummary(events: RelativePitchAttemptEvent[]): RelativePitchSummary` — per-degree accuracy per mode, answer-mode breakdown, singing usage rate; the typed provider milestone 19 consumes                                                                                                                                                                                                                                                                                                                       |
| `src/lib/audio/scale-degree-scoring.ts`        | **Create** | `scoreScaleDegreeSungAttempt(frequencyHz, targetDegree, key, mode, clarity): ScaleDegreeSungVerdict` — thin layer over `frequencyToPitchScore` from `src/lib/audio/pitch-scoring.ts`; **octave-agnostic**: does not call `classifyOctaveError`, any octave matching the correct degree returns `'correct-degree'`                                                                                                                                                                                                              |
| `src/lib/audio/cadence.ts`                     | **Create** | `playCadence(tonicPc: PitchClass, mode: 'major' \| 'natural-minor', synth: Synth): Promise<void>` — sequences four chords using the M01 lookahead scheduler; stub for Octavian #22; does not call `synth.stopAll()` (drone must survive)                                                                                                                                                                                                                                                                                       |
| `src/lib/audio.ts`                             | **Modify** | Add `playDrone(frequencyHz: number): void` and `stopDrone(): void` to the `Synth` class. The drone uses an independent `GainNode` not registered in `#voices` and not stopped by `stopAll()`. `stopDrone()` ramps the gain to zero and stops the source; it is idempotent.                                                                                                                                                                                                                                                     |
| `src/lib/pocket-mode.ts`                       | **Create** | `getPocketSpeech(): SpeechSynthesis \| null` (SSR-safe: `typeof window === 'undefined'` guard); `POCKET_ANSWER_DELAY_MS = 3000`; `speakScaleDegree(degree, tonicPc, mode, answerMode): void` (no-op when speech unavailable); no Svelte runes, unit-testable with `vi.stubGlobal`                                                                                                                                                                                                                                              |
| `src/lib/music.ts`                             | **Modify** | Add `NATURAL_MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10] as const`; `naturalMinorScalePitchClasses(tonicPc: PitchClass): PitchClass[]`; `scaleDegreeToRelativePc(tonicPc, degree, mode): PitchClass`; `relativeScaleDegree(tonicPc, pitchClass, mode): ScaleDegree \| null`                                                                                                                                                                                                                                                 |
| `src/lib/relative-pitch-state.svelte.ts`       | **Create** | `createRelativePitchState()` factory: all `$state` inside the closure (SSR-safe); RP settings (`tonicPc`, `mode`, `tonicSetup`, `answerMode`, `pocketMode`, pocket delay); RP score state (separate from AP); round lifecycle (idle → guessing → feedback → idle); drone and mic session references as plain `let`; pocket-mode timer as plain `let pocketTimer`; `destroy()` stops drone, stops mic tracks, clears timer, cancels `speechSynthesis`; `[getRelativePitchContext, setRelativePitchContext]` via `createContext` |
| `src/routes/relative-pitch/+page.svelte`       | **Create** | RP entry route; calls `createRelativePitchState()` and `setRelativePitchContext(state)`; `onDestroy(() => state.destroy())`; renders `<RpSetupCard>` when idle, `<RpPracticeCard>` when active; no `+page.server.ts`                                                                                                                                                                                                                                                                                                           |
| `src/lib/components/rp-setup-card.svelte`      | **Create** | Tonic picker (all 12 pitch classes), mode toggle (major / natural minor), tonicSetup selector (drone / cadence / both / none), answerMode selector (all five modes), pocket-mode toggle with configurable delay; keyboard-navigable; all controls have `aria-pressed` or `aria-checked`                                                                                                                                                                                                                                        |
| `src/lib/components/rp-practice-card.svelte`   | **Create** | Scale-degree prompt display; answer surface per `answerMode` (direct dynamic component `<AnswerSurface />`—not `<svelte:component>`); feedback text in `aria-live="polite"` region; pocket-mode Start/Stop buttons with `aria-pressed`; composes `<singing-card.svelte>` (shipped in M04) when `answerMode === 'microphone'`                                                                                                                                                                                                   |
| `src/lib/components/tonic-drone.svelte`        | **Create** | Thin wrapper: calls `synth.playDrone()` on mount when tonicSetup includes drone; calls `synth.stopDrone()` on destroy; accessible start/stop for SR users; `role="status"` announces drone state                                                                                                                                                                                                                                                                                                                               |
| `src/lib/state.svelte.ts`                      | **Modify** | Add `track: 'absolute-pitch'` to every `AttemptEvent` emitted by the AP state factory (the only change required by the version-2 bump)                                                                                                                                                                                                                                                                                                                                                                                         |

### Type Contracts

```typescript
// src/lib/learning/drills/rp-attempt.ts

export type ScaleDegreeSungVerdict = 'wrong-degree' | 'correct-degree' | 'uncertain';

export type ScaleDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type RpAnswerMode =
	'movable-do' | 'fixed-do' | 'letter-name' | 'scale-degree' | 'microphone';

export type TonicSetup = 'drone' | 'cadence' | 'both' | 'none';

export type RelativePitchAttemptEvent = {
	readonly kind: 'rp-attempt';
	readonly version: 2;
	readonly track: 'relative-pitch';
	readonly sessionId: string;
	readonly drillId: string;
	readonly timestamp: number;
	readonly responseTimeMs: number;
	readonly tonicPc: PitchClass; // 0–11
	readonly mode: 'major' | 'natural-minor';
	readonly tonicSetup: TonicSetup;
	readonly targetScaleDegree: ScaleDegree;
	readonly answerMode: RpAnswerMode;
	readonly answer: string; // e.g. 'sol', 'G', '5'
	readonly correctAnswer: string; // canonical label in the same encoding
	readonly scaleDegreeCorrect: boolean;
	// Present only when answerMode === 'microphone':
	readonly sungFrequencyHz?: number;
	readonly centsOffset?: number;
	readonly clarity?: number;
	readonly sungVerdict?: ScaleDegreeSungVerdict;
};
```

```typescript
// src/lib/learning/protocols/relative-pitch.ts

export type RpDrillConfig = {
	drillId: string;
	seed?: string;
	tonicPc: PitchClass;
	mode: 'major' | 'natural-minor';
	tonicSetup: TonicSetup;
	eligibleDegrees: ScaleDegree[]; // defaults to [1, 2, 3, 4, 5, 6, 7]
	answerMode: RpAnswerMode;
};

export type RpPrompt = {
	promptId: string;
	tonicPc: PitchClass;
	mode: 'major' | 'natural-minor';
	targetScaleDegree: ScaleDegree;
	targetPc: PitchClass;
	correctAnswers: Record<RpAnswerMode, string>; // pre-computed for all modes
};
```

```typescript
// src/lib/audio/scale-degree-scoring.ts

/**
 * Scores a sung frequency against a target scale degree.
 * Octave-agnostic: any octave that matches the correct pitch class passes.
 * Does NOT call classifyOctaveError — correct-degree/wrong-octave is credited.
 *
 * @param frequencyHz  - raw detected frequency in Hz
 * @param targetDegree - 1–7
 * @param tonicPc      - tonic pitch class, 0–11
 * @param mode         - 'major' | 'natural-minor'
 * @param clarity      - pitchy clarity; reads below SUNG_CLARITY_THRESHOLD (from M04) return 'uncertain'
 */
export function scoreScaleDegreeSungAttempt(
	frequencyHz: number,
	targetDegree: ScaleDegree,
	tonicPc: PitchClass,
	mode: 'major' | 'natural-minor',
	clarity: number
): ScaleDegreeSungVerdict;
```

### Answer-Mode Canonicalization

`canonicalizeRpAnswer(mode: RpAnswerMode, label: string, context: { tonicPc: PitchClass; mode: 'major' | 'natural-minor' }): PitchClass | null` lives in `src/lib/learning/protocols/relative-pitch.ts`. The fixed-do/movable-do distinction is resolved explicitly:

- **Movable-do**: 'Do' always equals the tonic pitch class. In F major, 'Sol' = C (pc 0), not G.
- **Fixed-do**: 'Do' always equals C (pc 0), regardless of key.
- **Letter name**: direct pitch-class lookup ('C' = 0, 'G' = 7, etc.).
- **Scale degree**: '1' through '7' map to `scaleDegreeToRelativePc(tonicPc, degree, mode)`.

The solfege convention for natural minor is **do-based**: degree 3 in A minor (C) is labeled 'Me' (or 'Mi♭'), not 'Do'. The `scaleDegreeLabel` function in `learning/protocols/relative-pitch.ts` encodes this as a lookup table keyed on `[degree, mode]`, which is the authoritative source of truth until Octavian #18 ships.

### Pocket Mode Architecture

Pocket mode uses `setTimeout` chains cleared in `destroy()`, following the `autoAdvanceTimer` pattern in `state.svelte.ts`. Do not use `$effect` to drive timing loops.

- Spoken answer: if `getPocketSpeech()` returns non-null, call `speechSynthesis.speak(new SpeechSynthesisUtterance(feedbackText))` after the configured delay.
- Visual fallback: if `getPocketSpeech()` returns null, display the answer in an `aria-live="polite"` region after the same delay and show a one-per-session notice.
- `destroy()` calls both `speechSynthesis.cancel()` and `clearTimeout(pocketTimer)`.
- The `aria-live="polite"` region is always present and receives the feedback text regardless of TTS availability, so screen-reader users are served by the standard accessibility tree without `speechSynthesis` interference.

### SSR Safety Invariants

- `getPocketSpeech()`: `typeof window === 'undefined'` guard.
- `DroneVoice` and `playCadence()`: called only after a user gesture, never at module load.
- All `$state` fields in `relative-pitch-state.svelte.ts` are inside the factory closure.
- `src/lib/learning/protocols/relative-pitch.ts` has zero browser globals—pure functions only, unit-testable in Node.

## Dependencies

- **Milestone 10** (Answer Surfaces, MIDI, and Accessibility): provides the answer-surface configuration system, solfege and scale-degree button surfaces, and keyboard shortcut infrastructure that RP inherits.
- **Milestone 03** (Microphone Pitch-Detection Spike): provides `src/lib/audio/microphone.ts` with `MicPermission`, `MicrophoneSession`, `requestMicrophone`, `CLARITY_THRESHOLD`, `detectPitch`, and the gesture-gated `getUserMedia` pattern. The GO/NO-GO feasibility decision is recorded in `docs/spikes/microphone-feasibility.md` and must be GO before any singing-specific code in this milestone is authored.

> **Note on productionized mic runtime.** The mic primitives used for scale-degree singing (`frequencyToPitchScore`, `classifyOctaveError` as a reference, `mic-permission-gate.svelte`, `pitch-meter.svelte`, `SUNG_CLARITY_THRESHOLD`, and `createPitchDetectorStub`) were introduced in **M04 (Transfer, Register, and Singing)**, which shipped before this milestone. Those files live at `src/lib/audio/pitch-scoring.ts`, `src/lib/audio/pitch-detection.svelte.ts`, and `src/lib/components/`. M11 imports from those paths—it does not re-implement or duplicate any of them. M04 is reachable transitively through M03.
>
> - If M03 recorded **GO**: the full singing branch of M11 may proceed (M04 will have shipped its mic runtime).
> - If M03 recorded **NO-GO**: the singing branch of M11 is deferred in full. The non-mic RP track ships unaffected. Open a follow-up issue via `gh issue create` before any singing-specific code is written.

## External Dependency Contracts

| Capability                                 | Owner                                                             | Contract                                                                                          | Stub/mock plan                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solfege and scale-degree name helpers      | [Octavian #18](https://github.com/stevekinney/octavian/issues/18) | `getScaleDegrees(tonicPc, mode) → PitchClass[]`; `degreeToSolfege(degree, mode, system) → string` | Implement `scaleDegreeLabel(degree, mode, tonicPc)` locally in `src/lib/learning/protocols/relative-pitch.ts` using a hardcoded lookup table. Movable-do: `['Do','Re','Mi','Fa','Sol','La','Ti']` (major); do-based minor uses accidentals for degrees 3, 6, 7. Replace with Octavian import when #18 ships; function signatures must match. |
| Chord/cadence progressions                 | [Octavian #22](https://github.com/stevekinney/octavian/issues/22) | `buildCadence(tonicPc, mode) → PitchClass[][]` — 4 chords as pitch-class arrays                   | Hardcode I–IV–V–I as relative semitone offsets in `src/lib/audio/cadence.ts`: major `[[0,4,7],[5,9,0],[7,11,2],[0,4,7]]`, natural minor `[[0,3,7],[5,8,0],[7,11,2],[0,3,7]]`. Replace with Octavian import when #22 ships.                                                                                                                   |
| Timed pitch sequences                      | [Octavian #30](https://github.com/stevekinney/octavian/issues/30) | Musical-time-to-AudioContext-time conversion                                                      | Use the M01 lookahead scheduler primitives already available via the M10 dependency chain. `playCadence` in `src/lib/audio/cadence.ts` calls the scheduler directly. No additional stub needed.                                                                                                                                              |
| Frequency-to-note scoring                  | [Octavian #33](https://github.com/stevekinney/octavian/issues/33) | `frequencyToPitchScore(hz) → { nearestPitch, centsOffset }`                                       | Already implemented as production code in `src/lib/audio/pitch-scoring.ts` (M04). Import from there—do not re-stub.                                                                                                                                                                                                                          |
| Answer comparison / enharmonic equivalence | [Octavian #35](https://github.com/stevekinney/octavian/issues/35) | `pitchClassEquals(a, b): boolean`                                                                 | Use `a % 12 === b % 12` inline in `canonicalizeRpAnswer`. Replace with Octavian import when #35 ships.                                                                                                                                                                                                                                       |
| Mic permission gate UI                     | [Cinder #321](https://github.com/stevekinney/cinder/issues/321)   | `<PermissionGate permission={MicPermission} onrequest={() => void} children={Snippet} />`         | Already implemented as `src/lib/components/mic-permission-gate.svelte` (M04). M11 reuses—do not re-implement.                                                                                                                                                                                                                                |
| Pitch meter visualization                  | [Cinder #324](https://github.com/stevekinney/cinder/issues/324)   | `<PitchMeter frequencyHz targetHz centsOffset verdict />`                                         | Already implemented as `src/lib/components/pitch-meter.svelte` (M04). M11 reuses.                                                                                                                                                                                                                                                            |
| Web Speech TTS (pocket mode)               | Browser platform                                                  | `window.speechSynthesis` / `SpeechSynthesisUtterance`                                             | Stub via `vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn() })` in unit tests. Detect at runtime: `typeof window.speechSynthesis !== 'undefined'`.                                                                                                                                                                          |

## Acceptance Criteria

### RP track entry

1. A learner can navigate to the Relative Pitch track from the landing page without completing or starting an AP placement test. The RP entry point is visible on first visit.
2. RP and AP entry points are distinct; choosing one does not start the other.

### Tonal context

3. A learner can configure tonal context as drone only, cadence only, both, or neither, and the choice persists across sessions. All four `TonicSetup` values are accepted by `createRelativePitchState` and stored under `vibratone:rp-settings`.
4. When drone is enabled, a continuous tonic drone plays during the answer window and does not stop when `play()` is called for the prompt note. Verified by a unit test: `Synth.playDrone: sustaining a drone does not stop when play() is called`.
5. When cadence is enabled, a four-chord cadence plays before the prompt tone. Verified by a Playwright spec that confirms audio events fire before the prompt.
6. When drone is disabled, no sustained tone plays after the prompt. When cadence is disabled, no chord sequence plays.

### Scale-degree identification

7. Scale-degree prompts cover degrees 1–7 in at least one major key and one natural minor key. A unit test seeds `generateRpPrompt` and confirms all seven degrees are reachable.
8. Non-mic answers (movable-do, fixed-do, letter name, scale-degree number) score correctly against the target degree in both major and natural minor. Unit tests cover all four modes in C major and A natural minor.
9. Fixed-do 'Do' and movable-do 'Do' resolve to different pitch classes when the tonic is not C. A dedicated divergence unit test asserts this.

### Scale-degree singing (mic-gated)

10. When mic permission is granted, a sung frequency that matches the correct degree in any octave returns `verdict: 'correct-degree'`. Named unit test: `scoreScaleDegreeSungAttempt: correct degree sung in wrong octave returns 'correct-degree'`.
11. When clarity is below `SUNG_CLARITY_THRESHOLD`, `scoreScaleDegreeSungAttempt` returns `'uncertain'`. Named unit test: `scoreScaleDegreeSungAttempt: clarity below SUNG_CLARITY_THRESHOLD returns 'uncertain'`.
12. When mic permission is denied or mic is unavailable, the RP drill falls back to keyboard answer surfaces with no mic-specific UI shown and no sung-attempt events recorded. Verified by a Playwright spec with mic permission blocked.
13. Only derived fields are stored in RP sung-attempt events: detected note, cents offset, clarity score, scale-degree correctness verdict, key, mode, target degree, answer mode. No `AudioBuffer`, `Float32Array`, `MediaStream`, or raw frequency array enters any storage key. Named unit test: `RelativePitchAttemptEvent: serialized JSON contains no field named buffer, blob, ArrayBuffer, or Float32Array`.

### Pocket mode

14. After pressing Start, a complete prompt-answer-feedback cycle completes with zero pointer events. Verified by a Playwright spec that disables mouse input after Start and confirms one full cycle runs to completion.
15. Start and Stop controls are Tab-reachable and operable with Enter from any drill state. Verified by a keyboard-only Playwright spec.
16. Each feedback result is announced via `window.speechSynthesis` after the configured delay (default 3 s, range 1–10 s stored in learner settings). Named unit test: `pocket-mode: fires speechSynthesis.speak after the configured delay`.
17. When `speechSynthesis` is unavailable, the answer appears visually after the same delay and the learner is notified once per session. Named unit test: `pocket-mode: uses visual fallback when speechSynthesis is undefined`.
18. `speechSynthesis.cancel()` is called in `destroy()`. Named unit test: `pocket-mode: calls speechSynthesis.cancel on destroy`.
19. The pocket-mode delay is clamped to the 1–10 s range. Named unit test: `pocket-mode: delay is clamped to 1–10 s range`.
20. If mic or TTS becomes unavailable mid-session, the session pauses with a recoverable visible-and-announced error state (no silent hang, no crash). Named unit test: `pocket-mode: pauses with a recoverable error state when getUserMedia rejects after session start`.

### Analytics isolation

21. Every RP attempt event carries `track: 'relative-pitch'`. A unit test confirms that `computeApAnalytics` excludes events where `track !== 'absolute-pitch'`. Named test: `computeApAnalytics: excludes relative-pitch attempt events from pitch-class accuracy totals`.
22. RP FSRS cards are stored under a namespace distinct from AP cards. A unit test confirms no AP card key shares a prefix with an RP card key. Named test: `FSRS card identity: RP card key namespace does not overlap with AP card key namespace`.

### Drone/cadence audio teardown

23. Drone and cadence audio stop when the learner navigates away from the RP drill, both on client-side navigation and on page unload. Verified by calling `onDestroy(() => state.destroy())` in `+page.svelte` and by a unit test asserting `destroy()` calls `synth.stopDrone()`.

### Mic stream teardown

24. All `MediaStreamTrack` instances have `readyState === 'ended'` when the learner exits the RP singing drill. Named unit test: `createRelativePitchState: destroy() calls stopDrone() on the synth`. Verified by a Playwright spec that checks `track.readyState` after navigation.

### Honest claims gate

25. No UI string in `src/routes/relative-pitch/` or `src/lib/components/rp-*.svelte` contains "perfect pitch", "guaranteed", or "will learn". Verified by the grep gate in Verification. A visible text element in `rp-setup-card.svelte` explains that RP training serves a different goal from AP training.

### Today surface readiness

26. `getRelativePitchSummary` returns per-degree accuracy and due card count without reading any AP card state. Named unit test: `getRelativePitchSummary: given only RP events, AP summary is unaffected (no cross-contamination)`.

### Responsive layout

27. The RP setup card and practice card render without horizontal overflow at 390×844, 768×1024, and 1280×800. Verified by Playwright responsive specs.

## Test Plan

### Unit tests — `src/lib/learning/drills/rp-attempt.spec.ts`

- `isValidRelativePitchAttemptEvent: accepts a well-formed event with all required fields`
- `isValidRelativePitchAttemptEvent: rejects an object missing targetScaleDegree`
- `isValidRelativePitchAttemptEvent: rejects an event where track is not 'relative-pitch'`
- `isValidRelativePitchAttemptEvent: accepts an event with optional sungFrequencyHz present`
- `isValidRelativePitchAttemptEvent: accepts an event with optional singing fields absent`
- `RelativePitchAttemptEvent: serialized JSON contains no field named buffer, blob, ArrayBuffer, or Float32Array`

### Unit tests — `src/lib/learning/protocols/relative-pitch.spec.ts`

- `scaleDegreeLabel: movable-do returns 'Do' for degree 1, 'Sol' for degree 5`
- `scaleDegreeLabel: fixed-do returns the note name corresponding to C regardless of tonic`
- `scaleDegreeLabel: scale-degree returns '1' for degree 1, '7' for degree 7`
- `scaleDegreeLabel: movable-do 'Do' and fixed-do 'Do' return different pitch classes when tonic is not C`
- `generateRpPrompt: returns a prompt with targetPc within the mode's scale of tonicPc`
- `generateRpPrompt: identical seed and config produce the same prompt sequence`
- `generateRpPrompt: does not repeat the same scale degree back-to-back when pool is larger than 1`
- `generateRpPrompt: all 7 degrees are reachable across calls for the same config`
- `isScaleDegreeCorrect: returns true when answeredPc matches the target scale degree in C major`
- `isScaleDegreeCorrect: returns true when answeredPc matches the target scale degree in A natural minor`
- `isScaleDegreeCorrect: returns false when answeredPc is not in the scale`
- `isScaleDegreeCorrect: handles all 12 tonic pitch classes without error in major and minor`
- `canonicalizeRpAnswer: letter 'C' in any key returns 0`
- `canonicalizeRpAnswer: movable-do 'Sol' in F major (tonicPc 5) returns 0 (C)`
- `canonicalizeRpAnswer: fixed-do 'Do' in F major returns 0 (C, always)`
- `canonicalizeRpAnswer: scale-degree '5' in A major (tonicPc 9) returns 4 (E)`
- `canonicalizeRpAnswer: returns null for an unrecognized label in any mode`

### Unit tests — `src/lib/music.spec.ts` (additions)

- `naturalMinorScalePitchClasses: A minor returns [9, 11, 0, 2, 4, 5, 7]`
- `naturalMinorScalePitchClasses: all 12 tonics produce 7-element arrays with no duplicates`
- `scaleDegreeToRelativePc: degree 5 in C major returns 7 (G)`
- `scaleDegreeToRelativePc: degree 3 in A natural minor returns 0 (C)`
- `relativeScaleDegree: C in C major returns 1`
- `relativeScaleDegree: D♯ in C major returns null (not in scale)`

### Unit tests — `src/lib/audio/scale-degree-scoring.spec.ts`

- `scoreScaleDegreeSungAttempt: correct degree sung in wrong octave returns 'correct-degree'`
- `scoreScaleDegreeSungAttempt: wrong degree returns 'wrong-degree'`
- `scoreScaleDegreeSungAttempt: clarity below SUNG_CLARITY_THRESHOLD returns 'uncertain'`
- `scoreScaleDegreeSungAttempt: degree 3 in C major resolves to E regardless of octave`
- `scoreScaleDegreeSungAttempt: degree 3 in A natural minor resolves to C regardless of octave`

### Unit tests — `src/lib/audio/cadence.spec.ts`

- `playCadence: resolves after scheduling 4 chords`
- `playCadence: schedules distinct pitch sets for I-IV-V-I in C major`
- `playCadence: schedules distinct pitch sets for i-iv-V-i in A natural minor`
- `playCadence: does not call Synth.stopAll() (drone must survive cadence playback)`

### Unit tests — `src/lib/audio.spec.ts` (additions)

- `Synth.playDrone: sustaining a drone does not stop when play() is called for a prompt`
- `Synth.stopDrone: ramps drone gain to zero and stops oscillator`
- `Synth.stopDrone: is idempotent when called with no active drone`

### Unit tests — `src/lib/pocket-mode.spec.ts`

- `getPocketSpeech: returns null when window is undefined`
- `getPocketSpeech: returns window.speechSynthesis when available`
- `POCKET_ANSWER_DELAY_MS: equals 3000`
- `pocket-mode: fires speechSynthesis.speak after the configured delay`
- `pocket-mode: uses visual fallback when speechSynthesis is undefined`
- `pocket-mode: calls speechSynthesis.cancel on destroy`
- `pocket-mode: delay is clamped to 1–10 s range`
- `pocket-mode: pauses with a recoverable error state when getUserMedia rejects after session start`

### Unit tests — `src/lib/learning/drills/schema.spec.ts` (additions)

- `AttemptEvent version 2: isRelativePitchAttempt returns true for track 'relative-pitch'`
- `AttemptEvent version 2: isRelativePitchAttempt returns false for track 'absolute-pitch'`
- `track field: AP state emits AttemptEvent with track 'absolute-pitch'`

### Unit tests — `src/lib/learning/analytics/rp-summary.spec.ts`

- `getRelativePitchSummary: returns per-degree accuracy for each of 7 degrees`
- `getRelativePitchSummary: separates major accuracy from natural-minor accuracy`
- `getRelativePitchSummary: given only RP events, AP summary is unaffected (no cross-contamination)`
- `getRelativePitchSummary: singingUsageRate is 0 when no events have answerMode 'microphone'`

### Unit tests — `src/lib/learning/analytics/ap-analytics.spec.ts` (additions)

- `computeApAnalytics: excludes relative-pitch attempt events from pitch-class accuracy totals`
- `computeApAnalytics: includes only events with track 'absolute-pitch' in session aggregates`

### Unit tests — `src/lib/learning/scheduling/fsrs-identity.spec.ts`

- `FSRS card identity: RP card key namespace does not overlap with AP card key namespace`
- `FSRS card identity: RP card key prefixed with 'rp::' not 'ap::'`

### Unit tests — `src/lib/relative-pitch-state.svelte.spec.ts`

- `createRelativePitchState: initial phase is 'idle'`
- `createRelativePitchState: guess() in major emits RelativePitchAttemptEvent with track 'relative-pitch'`
- `createRelativePitchState: guess() does not emit an event when phase is not 'guessing'`
- `createRelativePitchState: RP score does not change when AP state.guess() is called (isolation)`
- `createRelativePitchState: destroy() clears the pocket-mode delay timer`
- `createRelativePitchState: destroy() calls stopDrone() on the synth`
- `createRelativePitchState: destroy() calls stop() on every mic stream track`
- `createRelativePitchState: persistence round-trips to vibratone:rp-settings without overwriting vibratone:settings`

### Component tests — `src/lib/components/rp-setup-card.svelte.test.ts`

- `RpSetupCard: tonic picker renders all 12 pitch classes as selectable options`
- `RpSetupCard: mode toggle switches between major and natural minor`
- `RpSetupCard: tonicSetup selector has keyboard-accessible options for drone, cadence, both, none`
- `RpSetupCard: all four tonicSetup options are Tab-reachable and selectable with Enter`
- `RpSetupCard: selected tonicSetup state is communicated with aria-checked or aria-pressed, not color alone`
- `RpSetupCard: tonicSetup selector does not trap focus`
- `RpSetupCard: answerMode selector shows all five answer modes`
- `RpSetupCard: pocket-mode toggle carries aria-pressed attribute`

### Component tests — `src/lib/components/rp-practice-card.svelte.test.ts`

- `RpPracticeCard: displays scale-degree prompt in guessing phase`
- `RpPracticeCard: movable-do answer surface labels show 'Do Re Mi Fa Sol La Ti'`
- `RpPracticeCard: letter-name surface shows the 7 letter names for the current key`
- `RpPracticeCard: scale-degree surface shows buttons labeled 1–7`
- `RpPracticeCard: renders mic answer surface when answerMode is 'microphone' and permission is allowed`
- `RpPracticeCard: shows keyboard answer surface when mic is denied`
- `RpPracticeCard: feedback text is rendered in an aria-live region`
- `RpPracticeCard: correct-degree feedback text is queryable by getByText`
- `RpPracticeCard: wrong-degree feedback text is queryable by getByText`
- `RpPracticeCard: uncertain feedback text is queryable by getByText`
- `RpPracticeCard: pocket-mode start button is keyboard-focusable with aria-pressed`

### Playwright e2e — `e2e/relative-pitch-entry.e2e.ts`

- `RP entry: learner can reach the Relative Pitch track from the landing page without AP placement`
- `RP entry: AP entry point remains visible and distinct on the same page`
- `RP entry: renders at phone (390×844), tablet (768×1024), and desktop (1280×800) without overflow`
- `RP entry: RP setup screen explains RP serves a different goal from AP training (getByText partial match)`

### Playwright e2e — `e2e/tonic-setup.e2e.ts`

- `tonic setup: drone plays during answer window when drone is enabled`
- `tonic setup: cadence plays before prompt when cadence is enabled`
- `tonic setup: no sustained tone plays when both drone and cadence are disabled`
- `tonic setup: all four options reachable by keyboard alone`
- `tonic setup: setup choice persists across page reload`

### Playwright e2e — `e2e/pocket-mode.e2e.ts`

- `pocket mode: full prompt-answer-feedback cycle completes with mouse disabled after Start`
- `pocket mode: Start and Stop are Tab-reachable and Enter-operable`
- `pocket mode: visual answer appears after configured delay when TTS is stubbed unavailable`
- `pocket mode: Start/Stop buttons carry aria-pressed and accessible names`

### Playwright e2e — `e2e/rp-mic-deny.e2e.ts`

- `RP mic deny: keyboard answer surface is shown when mic permission is blocked`
- `RP mic deny: no mic-specific UI is shown`
- `RP mic deny: learner can complete a full RP listening drill without mic`

### Playwright e2e — `e2e/rp-track-isolation.e2e.ts`

- `RP track isolation: localStorage vibratone:attempts:v1 after an RP session contains only events with track 'relative-pitch'`
- `RP track isolation: AP and RP events coexist in localStorage without one overwriting the other after mixed practice`

## Verification

```sh
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

**AP-claims grep gate (must return no matches):**

```sh
grep -rE "perfect pitch|guaranteed|will learn" src/routes/relative-pitch/ src/lib/components/rp-*.svelte
```

**Manual smokes (documented checklist, not a CI gate):**

- Chrome (latest, macOS): confirm drone sustains while prompt note plays; confirm cadence fires before prompt; confirm singing verdict text appears alongside pitch meter.
- Firefox (latest): confirm all four tonic-setup modes work; confirm keyboard-only path completes a full RP round.
- Safari (latest, macOS): confirm `getUserMedia` gesture association is intact; confirm TTS fires after the configured delay.
- Manual microphone smoke for scale-degree singing on Chrome (latest desktop) and at least one of Firefox or Safari. If mic is denied, confirm the keyboard-only RP path completes all drill types. Record results as a checklist comment on the pull request.
- Phone (390px viewport): confirm setup card and practice card fit without horizontal scroll; confirm Start/Stop pocket-mode buttons are touch-sized (≥ 44×44 px).
- Screen reader: confirm drone toggle, cadence, and scale-degree buttons are reachable and announced correctly.

## Non-Goals

- Do not make Relative Pitch required for AP learners. AP and RP are separate paths; choosing one does not block or delay the other.
- Do not add intervals and chords as listening drill types. Those belong to milestone 12 (Intervals and Chords as Supporting Skills).
- Do not add notation-dependent sight singing. Staff notation ships in milestone 14, which is after this milestone.
- Do not add rhythm microphone scoring. `RHYTHM_MIC_ENABLED = false` (established in M04) remains false. Do not remove or bypass this flag.
- Do not add AI-generated singing feedback. AI coach is milestone 17.
- Do not introduce a database, cloud sync, auth, or any server-side state. All RP progress and pocket-mode settings are local-first.
- Do not rebuild or duplicate the mic runtime. Reuse `requestMicrophone`, `MicrophoneSession`, `createPitchDetector`, `frequencyToPitchScore`, `mic-permission-gate.svelte`, and `pitch-meter.svelte` from M04 (Transfer, Register, and Singing).
- Do not reuse `scoreSungAttempt` from the AP singing milestone for scale-degree singing. It evaluates `classifyOctaveError` before pitch-class matching and will misclassify a correct-degree/wrong-octave attempt as `'likely-octave-error'`. Use `scoreScaleDegreeSungAttempt` from `src/lib/audio/scale-degree-scoring.ts` instead.
- Do not build the Today surface (milestone 19). Expose `getRelativePitchSummary` as a typed provider and write RP progress to localStorage so milestone 19 can consume both without cross-route context.

## Completion Signal

This milestone is complete when:

1. A learner can start a Relative Pitch track without AP placement, configure tonal context (drone, cadence, both, or neither), and complete scale-degree identification drills across major and natural minor with any configured non-mic answer mode.
2. RP attempts are isolated from AP analytics: every RP event carries `track: 'relative-pitch'`, AP analytics aggregation excludes RP events, and RP FSRS cards use a distinct key namespace.
3. Pocket mode starts and runs a full hands-free cycle with either spoken (`speechSynthesis`) or delayed-visual answers; Start/Stop controls are keyboard-accessible.
4. A learner who declines microphone access can still complete every RP listening drill via non-mic answer surfaces with no mic-specific UI shown.
5. `bun run check`, `bun run lint`, `bun run test:unit -- --run`, and `bun run test:e2e` all pass.
6. All named tests in the Test Plan exist and pass.
7. The AP-claims grep gate returns no matches.
8. Manual microphone smoke is recorded in a PR checklist comment on Chrome plus at least one additional browser.
