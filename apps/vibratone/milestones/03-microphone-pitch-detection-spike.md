# 03. Microphone Pitch-Detection Spike

## Outcome

A developer or product reviewer can open a dedicated spike view, grant microphone permission, sustain a tone, and see a live pitch readout—detected note, cents offset, and clarity score—updating in real time. This unblocks the GO/NO-GO decision governing singing and pitch-production drills in milestone 08 (AP Singing and Pitch Production) and the singer-track microphone features in milestone 11 (Relative Pitch and Singer Track). The microphone is the highest-risk browser surface in the product; this milestone establishes the privacy posture—raw audio never leaves the browser, never enters storage—that every later singing and pitch-production feature inherits.

---

## Product Requirements

- Prototype microphone pitch detection using `getUserMedia`, `AnalyserNode`, and `pitchy`.
- Display a live pitch readout (detected note name, cents offset, clarity score) in a developer/spike UI at `src/routes/(spike)/microphone/+page.svelte`, served at `/microphone`.
- Support a reference frequency input (Hz) in the spike UI so the octave-error detection oracle has a known ground truth to compare against.
- Handle all five microphone permission states: idle, requesting, allowed, denied, and unavailable (no `navigator.mediaDevices` in the environment).
- Stop all `MediaStreamTrack` instances when the user navigates away from the spike view or clicks a Stop button.
- Record a GO/NO-GO feasibility decision in `docs/spikes/microphone-feasibility.md` before the milestone is closed. The decision is computed from five measured metrics against explicit thresholds (see Acceptance Criteria). No further product judgment is required to compute it.

### GO/NO-GO Decision Rule

All five thresholds below must be met for a GO result. A junior can compute the decision from the recorded measurements without additional product input.

| Metric                                                | Pass threshold                                                                                                                                                                                                                                                                                                                                | How to measure                                                                                                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Median absolute cents error                           | ≤ 25 cents                                                                                                                                                                                                                                                                                                                                    | 50 sustained tones (440 Hz–880 Hz) in a quiet environment using the reference tone source specified below; unit test confirms the computation; manual measurement records actual values     |
| Octave-error rate                                     | ≤ 20%                                                                                                                                                                                                                                                                                                                                         | 50 sustained-tone samples across the pitch range using the same tone source; note cases where second-harmonic dominance flips the octave; oracle is target-relative (see Data Requirements) |
| Clarity threshold for confident detection             | ≥ 0.90 (pitchy clarity score)                                                                                                                                                                                                                                                                                                                 | All confident detections meet this; reads below this threshold are logged as `uncertain`, never surfaced as wrong                                                                           |
| Round-trip latency (mic-open to first stable reading) | ≤ 150 ms                                                                                                                                                                                                                                                                                                                                      | Measured on Chrome desktop from `getUserMedia` resolution to first frame with clarity ≥ 0.90                                                                                                |
| Cross-browser reproducibility                         | On the second browser (Firefox desktop or Safari desktop), all four numeric thresholds above (cents error ≤ 25, octave-error rate ≤ 20%, clarity ≥ 0.90, latency ≤ 150 ms) are also met; manual smoke covers allow, deny, unavailable, and cleanup states on that browser; and the findings artifact records actual values from both browsers | Manual smoke on Firefox desktop or Safari desktop after Chrome smoke passes; actual threshold values from each browser entered in `docs/spikes/microphone-feasibility.md`                   |

**Reference device for GO/NO-GO measurement:** The primary measurement device must be documented by model and OS (e.g., MacBook Pro M3, macOS 15, built-in microphone) in `docs/spikes/microphone-feasibility.md`. If a mobile device is available, record it as a secondary entry. GO is declared only when the primary device meets all five thresholds.

**Tone source for manual measurement:** Generate reference tones using the existing `getSynth()` oscillator playing known frequencies at the target Hz via the reference frequency input in the spike UI, or an external tone generator locked to equal temperament. Log the tool name and version in `docs/spikes/microphone-feasibility.md`. Results from ad hoc voice humming without a reference generator are not sufficient for GO/NO-GO determination.

**GO outcome:** Record GO in `docs/spikes/microphone-feasibility.md`. Milestone 08 (AP Singing and Pitch Production) may include sing-back prompts, pitch-production scoring, and clarity-gated attempt classification. Milestone 11 (Relative Pitch and Singer Track) may include scale-degree singing, pocket-mode microphone drills, and ear-to-voice transfer exercises.

**NO-GO outcome:** Record NO-GO with the specific failing metric and its measured value. Both milestone 08 (AP Singing and Pitch Production) and milestone 11 (Relative Pitch and Singer Track) must exclude all singing and pitch-production features from their scope until a follow-up milestone resolves the failing metric. Open that follow-up immediately via `gh issue create`, referencing the specific failing row and its measured value. Milestones 04, 05, 06, 07, 09, 10, 12, and all later milestones are unaffected by a NO-GO result—the drill schema, FSRS scheduling, AP level progression, and theory tracks do not require microphone input.

The findings artifact must include: the five thresholds above, actual measured values, the primary and secondary device/browser matrix tested, the tone source used, and the GO/NO-GO conclusion.

---

## User Experience Requirements

- The spike view is not reachable from the main AP trainer navigation. The `(spike)` SvelteKit route group keeps it isolated. The served URL is `/microphone`—the parenthesised group segment is stripped by SvelteKit routing and does not appear in the browser address bar.
- The "Enable Microphone" button is the primary entry point. Acquisition must be triggered by a user gesture (click), never on mount or in a reactive effect. This matches the `getSynth()` pattern in `audio.ts`.
- The detected note, cents offset, and clarity score are displayed visually while the microphone is active. These fields update at frame rate and must NOT be placed in an `aria-live` region—a screen reader torrent at 30+ fps is unusable.
- Audio failures and permission denials produce a recoverable visible state, not a blank or broken view.
- The spike UI includes a reference frequency input (number field, labeled in Hz) that feeds the octave-error detection oracle. Default value: 440.
- The Stop button is visible and functional while the microphone is active.
- The app remains usable at phone, tablet, and desktop widths (390×844, 768×1024, 1280×800).

---

## Data and Analytics Requirements

Milestone 03 does NOT write to the versioned attempt-event log introduced in milestone 00. Pitch-detection readings during the spike are written to a separate in-memory `MicrophoneFeasibilityEvent[]` diagnostic buffer. This buffer:

- Is exposed on the `createMicrophoneState()` factory return object for display in the spike UI.
- Is never persisted to `localStorage`, `sessionStorage`, `IndexedDB`, or any external surface.
- Is not typed as an `AttemptEvent` (the milestone 00 shape).
- Is cleared when `destroy()` is called.

The point at which pitch-detection results enter the attempt-event log, if the GO decision is recorded, is milestone 08 (AP Singing and Pitch Production). At that point `MicrophoneFeasibilityEvent` either becomes a subtype of `AttemptEvent` or is replaced by it. That decision is deferred to milestone 08.

### MicrophoneFeasibilityEvent shape

```ts
/**
 * A single pitch-detection reading from the AnalyserNode written to the
 * in-memory diagnostic buffer. NOT an AttemptEvent (milestone 00 shape).
 * Milestone 08 promotes this to the attempt-event log if the GO decision is
 * recorded.
 */
export type MicrophoneFeasibilityEvent = {
	/** Raw frequency in Hz from pitchy. */
	frequencyHz: number;
	/** Nearest equal-temperament note label, e.g. "A4". */
	detectedNote: string;
	/** Cents deviation from the nearest equal-temperament pitch, -50 to +50. */
	centsOffset: number;
	/** Clarity score 0–1 from pitchy. */
	clarityScore: number;
	/**
	 * True when the detected pitch class matches the reference but the octave
	 * differs by ±1 — evidence of second-harmonic dominance.
	 * False when no reference frequency is set.
	 */
	octaveErrorDetected: boolean;
	/**
	 * True when clarityScore is below CLARITY_THRESHOLD (0.9).
	 * Uncertain readings are logged separately and never surfaced as wrong.
	 */
	uncertain: boolean;
	/** Always false for spike events — no reference pitch is played before capture. */
	hadReferencePitch: false;
	/** Unix timestamp in ms. */
	timestamp: number;
};
```

**Privacy invariant (hard requirement):** Only the fields above may enter the diagnostic buffer. Raw `AudioBuffer` samples, `Float32Array` analyser data, and `MediaStream` tracks must never be stored to any Web Storage key, `IndexedDB`, or any network surface. Enforcement: a unit test asserts the pitch-detection function returns only the permitted shape with no buffer-storage side effect (see Test Plan).

### Octave-error oracle

An octave error is defined as: the detected pitch class matches the pitch class of the reference frequency, but the detected octave differs by ±1 from the reference octave. This is the target-relative definition—it requires a reference frequency, which the spike UI supplies via the reference frequency input. The oracle is implemented in `isOctaveError(detectedHz, referenceHz)` in `src/lib/audio/microphone.ts`.

---

## Accessibility Requirements

- The `microphone-permission.svelte` component communicates permission state via ARIA live regions:
  - States `idle`, `requesting`, and `allowed` use `role="status"` with `aria-live="polite"`.
  - States `denied` and `unavailable` use `role="alert"` with `aria-live="assertive"`.
- Announced text per state: `idle` → "Microphone off", `requesting` → "Requesting microphone access…", `allowed` → "Microphone active", `denied` → "Microphone access denied. Allow access in browser settings.", `unavailable` → "Microphone is not available in this browser."
- Each state renders a non-empty visible text description. The component is never icon-only.
- The "Enable Microphone" button uses `aria-disabled` (not `disabled`) during the `requesting` state so screen readers can still focus it. Because `aria-disabled` keeps the button clickable, `start()` must include a re-entry guard (see Module and Architecture Targets).
- The "Stop" button has an accessible name and is keyboard-focusable in the `allowed` state.
- The detected note, cents offset, and clarity readout are visual-only. They must NOT be wrapped in an `aria-live` region.
- The spike view must have at least one complete keyboard-only path: Tab to the Enable Microphone button, activate with Enter, see a state announcement.
- Responsive smoke must cover phone (390×844), tablet (768×1024), and desktop (1280×800) widths.

---

## Module and Architecture Targets

Nothing in this milestone lands in `learning/`. Microphone and pitch detection are browser-audio runtime concerns. The `learning/` tree is for drill schemas, scheduling, analytics, and protocol rules.

### New files

**`src/lib/audio/microphone.ts`** — pure, unit-testable browser-runtime helpers. No Svelte runes (`$state`, `$derived`, `$effect`). No imports of Svelte or SvelteKit. Unit-tested via the server vitest project.

```ts
/** Permission FSM states for microphone acquisition. */
export type MicPermission = 'idle' | 'requesting' | 'allowed' | 'denied' | 'unavailable';

/**
 * A single pitch-detection reading derived from the AnalyserNode.
 * All fields are computable from pitchy output + the local octavian/pitch stub.
 */
export type PitchEstimate = {
	frequencyHz: number;
	detectedNote: string; // e.g. "A4"
	centsOffset: number; // -50 to +50
	clarityScore: number; // 0–1 from pitchy
	octave: number; // scientific pitch octave of detected note
	octaveErrorDetected: boolean;
	uncertain: boolean; // true when clarityScore < CLARITY_THRESHOLD
};

/**
 * Clarity threshold below which a reading is classified as uncertain.
 * This threshold governs the spike/feasibility context only.
 * Milestone 08 (AP Singing and Pitch Production) sets CLARITY_THRESHOLD = 0.85
 * for its learner-facing scoring context. The spike threshold and the production
 * scoring threshold are intentionally separate constants; do not unify them
 * without explicit product review.
 */
export const CLARITY_THRESHOLD = 0.9;

/**
 * Thin wrapper over pitchy so tests never import pitchy directly.
 * Returns null when pitchy reports no fundamental.
 */
export function detectPitch(
	buffer: Float32Array,
	sampleRate: number
): { frequencyHz: number; clarityScore: number } | null;

/**
 * Derive a full PitchEstimate from raw pitchy output.
 * Uses the octavian/pitch stub until Octavian #33 ships.
 * @param referenceHz - optional reference frequency for octave-error detection; omit when no reference is available
 */
export function scorePitchEstimate(
	frequencyHz: number,
	clarityScore: number,
	referenceHz?: number
): PitchEstimate;

/**
 * Nearest equal-temperament note name (e.g. "A4") for a frequency in Hz.
 * Local stub pending Octavian #33.
 * Algorithm: MIDI = round(69 + 12 * log2(hz / 440)); derive name from
 * SHARP_NAMES[MIDI % 12] and octave from floor(MIDI / 12) - 1.
 * Uses SHARP_NAMES from src/lib/music.ts.
 */
export function frequencyToNoteName(hz: number): string;

/**
 * Cents deviation of hz from the nearest equal-temperament semitone.
 * Range: -50 to +50.
 */
export function frequencyToCents(hz: number): number;

/**
 * True when the detected pitch class matches the reference pitch class
 * but the detected octave differs by exactly ±1.
 * Returns false when referenceHz is not provided.
 */
export function isOctaveError(detectedHz: number, referenceHz: number): boolean;
```

**`src/lib/audio/microphone.svelte.ts`** — Svelte 5 runes factory following the exact structural pattern of `state.svelte.ts`. Holds `$state` for permission, `PitchEstimate | null`, and the diagnostic buffer. Exports only `createMicrophoneState`—no context wiring. The factory result is passed as a prop within the single spike page; context is not needed for a single-page consumer and adds indirection with a throw-on-missing-provider risk.

Key constraints for the implementation:

- All `$state` variables are inside the factory closure, never at module level (SSR safety).
- The diagnostic buffer is declared as `$state.raw<MicrophoneFeasibilityEvent[]>([])` and replaced wholesale on each write (`events = [...events.slice(-200), newEvent]`)—a ring buffer capped at 200 entries. Events are only appended on meaningful transitions (confident detection, uncertain classification, octave-error flag), not on every rAF frame. The `estimate` field carries the current-frame value for live 60 Hz display.
- The rAF analysis loop is a plain imperative function stored as a `let` variable—not a rune. The loop writes to `$state` fields; components derive from those fields.
- `getUserMedia` acquisition occurs synchronously within the `start()` action, which is called from an `onclick` handler. Never called from `onMount`, `$effect`, `$effect.pre`, or any async path that loses the gesture association.
- `start()` must include a re-entry guard as its first statement: `if (permission !== 'idle') return;`. Without this guard, a second click on the `aria-disabled` button opens a second `getUserMedia` stream that is never assigned to the `stream` variable and never stopped by `destroy()`.
- The `MediaStream` reference is a plain `let` inside the factory (not `$state`—it never drives the template).
- The `navigator.permissions.query()` call and `permissionStatus.onchange` wiring must live exclusively inside the `createSubscriber` start callback (a client-only, effect-time code path). At factory construction, only read `typeof navigator === 'undefined' || !navigator.mediaDevices` for the initial permission value. Two writers must not race: the FSM (inside `start()`) owns all FSM transitions; the permissions-bridge revocation path owns only `stop()` + `permission = 'denied'` on an external revoke. This ownership rule is documented in the module JSDoc.
- `destroy()` calls `stream.getTracks().forEach(t => t.stop())`, cancels the rAF handle with `cancelAnimationFrame`, clears the events buffer, and resets permission to `'idle'`.

```ts
// Shape summary — implementation detail is in the file itself
export type MicrophoneState = {
	readonly permission: MicPermission;
	readonly estimate: PitchEstimate | null;
	readonly events: MicrophoneFeasibilityEvent[];
	readonly referenceHz: number;
	setReferenceHz(hz: number): void;
	start(): Promise<void>;
	stop(): void;
	destroy(): void;
};

export function createMicrophoneState(): MicrophoneState;
```

The initial permission value is `'unavailable'` when `typeof navigator === 'undefined' || !navigator.mediaDevices`. This is the SSR-safe guard that matches the `typeof window === 'undefined'` pattern in `audio.ts`.

**`src/routes/(spike)/microphone/+page.svelte`** — spike UI. Served at `/microphone` (the `(spike)` group is layout-scoping only; it does not appear in the served URL). Not in production navigation. Instantiates `createMicrophoneState()`, holds the result as a local variable `const mic = createMicrophoneState()`, and calls `onDestroy(() => mic.destroy())`. Passes `mic` as a prop to child components—no context. No `+page.server.ts`, no `load` function, no layout guard. Renders:

- Permission state component (`<MicrophonePermission state={mic} />`)
- Reference frequency input (number field, labeled "Reference frequency (Hz)", default 440)
- Enable Microphone / Stop buttons (rendered inside `microphone-permission.svelte` which accepts an `onstart` callback prop; see component spec below)
- Live pitch readout (detected note, cents offset, clarity score)—visual only, no `aria-live`
- Scrollable table of recent `MicrophoneFeasibilityEvent` entries from the diagnostic buffer

**`src/routes/(spike)/microphone/+page.ts`** (optional but recommended) — contains only:

```ts
export const ssr = false;
export const prerender = false;
```

This skips the server render pass entirely for a page that does nothing server-side. The SSR guards in `microphone.svelte.ts` must remain regardless—they protect the factory when called from tests or future server-side contexts.

**`src/lib/components/microphone-permission.svelte`** — ARIA-correct permission-state display component. Stub pending Cinder #321. Accepts `state: MicrophoneState` and an `onstart: () => void` callback prop, and renders the Enable Microphone and Stop buttons itself. Named exports match the expected Cinder prop interface so the swap is a one-line import change when #321 ships.

**`src/lib/audio/microphone.spec.ts`** — unit tests for all pure functions in `microphone.ts` plus FSM state-machine tests via `createMicrophoneState`. Runs in the server vitest project (Node, no browser globals). pitchy is mocked via `vi.mock`.

**`src/lib/audio/microphone.browser.spec.ts`** — privacy boundary tests that require real `localStorage` and `sessionStorage`. Runs in the client vitest project (Chromium). Named to route to the client project (verify against the project `include`/`exclude` globs in `vitest.config.ts`; rename to `microphone.svelte.test.ts` if the client project exclusively picks up `.svelte.test.ts` extensions).

**`src/lib/components/microphone-permission.svelte.test.ts`** — component tests using `vitest-browser-svelte`. Runs in the client vitest project (Chromium).

**`e2e/microphone.e2e.ts`** — Playwright specs using the `.e2e.ts` extension (required by `playwright.config.ts` `testMatch: '**/*.e2e.{ts,js}'`).

**`docs/spikes/microphone-feasibility.md`** — findings artifact. Must be committed before the milestone is closed. Contains: the five GO/NO-GO thresholds, actual measured values, primary and secondary device/browser matrix, tone source used, and the GO/NO-GO conclusion.

### Playwright configuration addition

Add to `playwright.config.ts` under `use.launchOptions.args` so stream-cleanup and privacy e2e specs work in CI without physical audio hardware:

```ts
use: {
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
},
```

`--use-fake-ui-for-media-stream` prevents the permission dialog from blocking the test. `--use-fake-device-for-media-stream` injects a sine-wave fake device so `getUserMedia` resolves to a real `MediaStreamTrack` that can be inspected for `readyState`.

### Gesture-gate enforcement

AC 26 (start() never called from a reactive lifecycle) is enforced as a **custom ESLint rule** (primary) targeting `CallExpression` callee names `onMount` and containing a nested call to `start()`, and the rune forms `$effect` and `$effect.pre`. The grep-based assertion in the spec file is a secondary mechanical check. The grep pattern must use escaped dollar signs to match the `$effect` rune literally: `/\$effect(?:\.pre)?\s*\([^)]*\)\s*\{[^}]*start\s*\(\)/`. The unescaped form `/$effect.../` anchors the end of string and never matches.

### No files modified

Milestone 00's attempt-event log in `src/lib/persistence.ts` is not extended by this milestone.

---

## Dependencies

- **Milestone 00** (Drill Schema, Attempt Event Log, and Note Trainer Conversion): the drill schema, versioned attempt-event log, and `audio.ts` patterns (gesture-gated `getSynth()`, `typeof window` SSR guard) are already established and this milestone follows the same conventions. The `state.svelte.ts` factory pattern is the structural template for `microphone.svelte.ts`.

No other milestones are required. Milestone 08 and milestone 11 are forward consumers of this milestone's GO/NO-GO result, not dependencies.

---

## External Dependency Contracts

### `pitchy` (third-party npm — not yet installed)

- **Capability:** McLeod pitch detection from `Float32Array` audio data
- **Owner:** npm — third-party package, no upstream issue
- **Install:** `bun add pitchy`
- **Contract:** `PitchDetector.forFloat32Array(bufferSize: number)` returns a detector. Calling `detector.findPitch(buffer: Float32Array, sampleRate: number)` returns `[frequency: number, clarity: number]`. When no fundamental is detected, clarity is near zero and frequency is unreliable.
- **Usage in codebase:** imported only in `src/lib/audio/microphone.ts` inside the `detectPitch` wrapper function. No other file imports pitchy directly.
- **Stub/mock plan:** Unit tests never import pitchy. They mock the `detectPitch` wrapper via `vi.mock` or by injecting a test double. Component tests and Playwright specs may use the real package.
  ```ts
  vi.mock('pitchy', () => ({
  	PitchDetector: {
  		forFloat32Array: () => ({ findPitch: vi.fn().mockReturnValue([440.0, 0.95]) })
  	}
  }));
  ```

### `octavian/pitch` — Octavian #33

- **Capability:** `frequencyToNoteName`, `frequencyToCents`, `isOctaveError` — frequency-to-note mapping, cents deviation, and pitch-estimate evaluation
- **Owner:** [Octavian #33](https://github.com/stevekinney/octavian/issues/33)
- **Contract:** Until #33 ships, these are implemented as a local stub inside `src/lib/audio/microphone.ts` using `SHARP_NAMES` from `src/lib/music.ts`:
  - `frequencyToNoteName(hz)`: MIDI = `Math.round(69 + 12 * Math.log2(hz / 440))`; pitch class = `MIDI % 12`; octave = `Math.floor(MIDI / 12) - 1`; name = `SHARP_NAMES[pc] + octave`. Uses the Unicode musical sharp character `♯` (U+266F) from `SHARP_NAMES`—not the ASCII `#`.
  - `frequencyToCents(hz)`: `1200 * Math.log2(hz / (440 * Math.pow(2, Math.round(12 * Math.log2(hz / 440)) / 12)))`, rounded to one decimal.
  - `isOctaveError(detectedHz, referenceHz)`: pitch classes match but octaves differ by ±1.
- **Stub/mock plan:** Local stub functions in `src/lib/audio/microphone.ts` with fixed signatures. When #33 ships, replace stub bodies with imports from `octavian/pitch`—import change only, no signature change.

### `octavian` subpath export packaging — Octavian #34

- **Capability:** subpath export infrastructure enabling `import { ... } from 'octavian/pitch'`
- **Owner:** [Octavian #34](https://github.com/stevekinney/octavian/issues/34)
- **Contract:** subpath resolution for `octavian/pitch`
- **Stub/mock plan:** Irrelevant until #33 ships. The local stub imports nothing from Octavian subpaths. `SHARP_NAMES` and `noteLabel` are already available from `src/lib/music.ts`.

### Cinder permission-state component — Cinder #321

- **Capability:** `<PermissionState state={MicPermission} onstart={fn} />` with ARIA live regions covering idle, requesting, allowed, denied, and unavailable states
- **Owner:** [Cinder #321](https://github.com/stevekinney/cinder/issues/321)
- **Contract:** component accepting `permission: MicPermission` and `onstart: () => void`, rendering the Enable Microphone and Stop buttons, and announcing state changes via `role="status"` / `role="alert"` live regions.
- **Stub/mock plan:** Implement `src/lib/components/microphone-permission.svelte` as a minimal local component matching the ARIA spec in Accessibility Requirements. The component's prop interface matches what #321 will export so the swap is a one-line import change. This local implementation serves as the contribution template for Cinder #321.

---

## Acceptance Criteria

Each criterion is a concrete pass/fail check. Criteria marked **[auto]** must pass in CI; criteria marked **[manual]** produce recorded observations in `docs/spikes/microphone-feasibility.md`.

### Pitch detection accuracy [auto + manual]

1. **[auto]** Given a synthetic 440 Hz sine wave at 44100 Hz sample rate, `scorePitchEstimate` returns `detectedNote === "A4"`, `|centsOffset| ≤ 5`, and `clarityScore ≥ 0.85`. (The 0.85 bar is a synthetic-signal sanity check distinct from the 0.9 operational confidence threshold.)
2. **[auto]** Given a 441 Hz input, `frequencyToCents` returns a positive value (A4 is sharp).
3. **[auto]** `CLARITY_THRESHOLD` is exactly `0.9`.
4. **[manual]** Over 50 sustained tones (440 Hz–880 Hz) on the documented reference device in a quiet environment using the documented tone source, median absolute cents error is ≤ 25 cents. Recorded in findings artifact.

### Octave-error detection [auto + manual]

5. **[auto]** When `detectedHz` has the same pitch class as `referenceHz` but differs by ±1 octave, `isOctaveError(detectedHz, referenceHz)` returns `true`.
6. **[auto]** When `detectedHz` and `referenceHz` have the same pitch and same octave, `isOctaveError` returns `false`.
7. **[auto]** A `PitchEstimate` produced from a frequency where `isOctaveError` is `true` has `octaveErrorDetected === true` in its shape.
8. **[manual]** Over 50 sustained-tone samples across the pitch range, octave-error rate is ≤ 20%. Recorded in findings artifact.

### Uncertain detection classification [auto]

9. **[auto]** When `clarityScore < CLARITY_THRESHOLD`, `scorePitchEstimate` returns `uncertain === true`.
10. **[auto]** An `uncertain === true` event is stored in the diagnostic buffer and is visually distinguished from confident detections in the spike UI (e.g., rendered with a distinct label or row class). No confident-detection count or alert is shown for uncertain readings.

### Privacy boundary [auto]

11. **[auto — client project]** `detectPitch` never writes to `localStorage` or `sessionStorage` during a detection pass. Verified by a spy on `localStorage.setItem` and `sessionStorage.setItem` in the client vitest project (Chromium), where these APIs exist. (The server project has no `localStorage`—running this spy there would produce a vacuous pass.)
12. **[auto]** `MicrophoneFeasibilityEvent` contains no `AudioBuffer`, `Float32Array`, or `MediaStream` reference. Assertable via TypeScript structural type check in the test.

### Permission state machine [auto]

13. **[auto]** Initial permission is `'unavailable'` when `navigator.mediaDevices` is absent.
14. **[auto]** `start()` transitions `idle → requesting` synchronously before `getUserMedia` resolves.
15. **[auto]** On successful `getUserMedia`, permission transitions to `'allowed'`.
16. **[auto]** On `getUserMedia` rejection with `NotAllowedError`, permission transitions to `'denied'`.
17. **[auto]** On `getUserMedia` rejection with `NotFoundError`, permission transitions to `'unavailable'`.

### Re-entry guard [auto]

18a. **[auto]** Calling `start()` a second time when permission is not `'idle'` is a no-op: `getUserMedia` is called exactly once and the final permission state is `'allowed'`.

### Stream cleanup [auto + e2e]

18. **[auto]** After `destroy()` is called, all `MediaStreamTrack` instances report `readyState === 'ended'` (mock stream with spy).
19. **[auto]** After `destroy()`, the rAF handle is cancelled (mock `requestAnimationFrame` with spy).
    19a. **[auto]** After `destroy()`, `state.events.length === 0`.
20. **[e2e]** Navigating away from `/microphone` causes all active mic tracks to stop (asserted via `page.evaluate` on `MediaStreamTrack.readyState`). Requires Chrome fake device flag.
21. **[e2e]** Clicking Stop while the mic is active causes `track.readyState` to become `'ended'` without navigation.

### Accessible state announcement [auto + e2e]

22. **[auto]** In `denied` and `unavailable` states, `microphone-permission.svelte` renders an element with `role="alert"` and `aria-live="assertive"`.
23. **[auto]** In `idle`, `requesting`, and `allowed` states, it renders `role="status"` with `aria-live="polite"`.
24. **[auto]** The Enable Microphone button has `aria-disabled` (not the `disabled` attribute) during the `requesting` state.
25. **[e2e]** Denying permission causes the ARIA live region to contain the announced text "Microphone access denied".

### Gesture gate [lint]

26. **[lint]** `start()` does not appear in any `$effect`, `$effect.pre`, or `onMount` call in `microphone.svelte.ts`. Primary enforcement: a custom ESLint rule targeting those callee names containing a nested `start()` call. Secondary check: named tests in the spec file assert the file text contains no `import.*onMount.*from.*['"]svelte['"]` and no escaped `\$effect(?:\.pre)?` containing `start()`.

### Responsive + keyboard [e2e]

27. **[e2e]** At each of 390×844, 768×1024, and 1280×800 viewports: no layout overflow AND the Enable Microphone button is visible (`toBeVisible()`) AND the permission status region is visible.
28. **[e2e]** The Enable Microphone button is Tab-reachable from the page landmark and activatable with Enter.

### GO/NO-GO decision recorded [manual]

29. **[manual]** `docs/spikes/microphone-feasibility.md` is committed and contains: all five thresholds, actual measured values, primary and secondary device/browser matrix, tone source used, and the GO/NO-GO conclusion. The milestone is not closeable without this file.

### Cross-browser [manual]

30. **[manual]** The spike view passes manual smoke on Chrome desktop and at least one additional browser (Firefox desktop or Safari desktop). All four numeric thresholds must be met on the second browser; allow, deny, unavailable, and cleanup states tested on each browser. Actual measured values from both browsers recorded in `docs/spikes/microphone-feasibility.md`.

### AP-claims guard [auto]

31. **[auto]** `grep -rE "perfect pitch|guaranteed|will learn" src/` returns no matches, including `src/routes/(spike)/microphone/+page.svelte`.

---

## Test Plan

### Unit tests — `src/lib/audio/microphone.spec.ts` (server vitest project, Node, no browser)

These tests cover pure functions in `microphone.ts` and FSM interactions via `createMicrophoneState`. pitchy is mocked via `vi.mock`. No `AnalyserNode`, `getUserMedia`, or real `MediaStream` is used.

**`detectPitch` wrapper:**

- `detectPitch: returns null when pitchy findPitch returns low clarity (< 0.2)`
- `detectPitch: returns { frequencyHz, clarityScore } when pitchy returns a clear tone`

**`frequencyToNoteName`:**

- `frequencyToNoteName: 440 Hz returns "A4"`
- `frequencyToNoteName: 880 Hz returns "A5"`
- `frequencyToNoteName: 261.63 Hz returns "C4"`
- `frequencyToNoteName: 466.16 Hz returns "A♯4"` (assertion uses Unicode musical sharp U+266F, not ASCII `#`)
- `frequencyToNoteName: 493.88 Hz returns "B4"` (boundary — must not round to C5)
- `frequencyToNoteName: 523.25 Hz returns "C5"` (C in next octave)
- `frequencyToNoteName: 27.5 Hz returns "A0"` (lowest piano note — lower boundary)
- `frequencyToNoteName: 4186.01 Hz returns "C8"` (highest piano note — upper boundary)

**`frequencyToCents`:**

- `frequencyToCents: 440 Hz returns 0 cents`
- `frequencyToCents: 441 Hz returns a positive value`
- `frequencyToCents: 439 Hz returns a negative value`
- `frequencyToCents: result is in range [-50, 50] for any input within one semitone of A4`

**`isOctaveError`:**

- `isOctaveError: 880 Hz detected with 440 Hz reference returns true (octave above)`
- `isOctaveError: 220 Hz detected with 440 Hz reference returns true (octave below)`
- `isOctaveError: 440 Hz detected with 440 Hz reference returns false`
- `isOctaveError: 442 Hz detected with 440 Hz reference returns false (same octave, slight detune)`
- `isOctaveError: 880 Hz detected with 880 Hz reference returns false (same octave, not an error)`
- `isOctaveError: 440 Hz (A4) detected with 261.63 Hz (C4) reference returns false (different pitch class)`

**`scorePitchEstimate`:**

- `scorePitchEstimate: 440 Hz, clarity 0.95, no reference → { detectedNote: "A4", centsOffset: 0, octaveErrorDetected: false, uncertain: false }`
- `scorePitchEstimate: 441 Hz, clarity 0.95 → centsOffset is positive`
- `scorePitchEstimate: clarity 0.85 → uncertain: true`
- `scorePitchEstimate: 880 Hz with referenceHz 440 → octaveErrorDetected: true`
- `scorePitchEstimate: return shape contains no AudioBuffer, Float32Array, or MediaStream field` (TypeScript structural assertion)

**`CLARITY_THRESHOLD`:**

- `CLARITY_THRESHOLD: equals 0.9`

**Permission state machine (via `createMicrophoneState` unit interactions — mock MediaStream):**

- `createMicrophoneState: initial permission is "unavailable" when navigator is absent`
- `createMicrophoneState: permission is "idle" when navigator.mediaDevices is present`
- `createMicrophoneState: calling start() transitions permission to "requesting" before getUserMedia settles`
- `createMicrophoneState: permission becomes "allowed" when getUserMedia resolves`
- `createMicrophoneState: permission becomes "denied" when getUserMedia rejects with NotAllowedError`
- `createMicrophoneState: permission becomes "unavailable" when getUserMedia rejects with NotFoundError`
- `createMicrophoneState: start() is a no-op when permission is not "idle"` (call `start()` twice, assert `getUserMedia` called once, final permission is `'allowed'`)
- `createMicrophoneState: setReferenceHz updates the reference used by subsequent pitch estimates` (set 880, mock 440 Hz detection, assert `octaveErrorDetected === true`; set back to 440, assert `octaveErrorDetected === false`)
- `createMicrophoneState: permission state updates to denied when permissionStatus fires onchange event mid-session` (mock `navigator.permissions.query` returning a fake `PermissionStatus` event target, fire `change` event, assert `state.permission === 'denied'`)
- `createMicrophoneState: destroy() clears the events diagnostic buffer` (push a synthetic event, call `destroy()`, assert `state.events.length === 0`)

**Gesture gate (static assertions — server project):**

- `microphone.svelte.ts: does not import onMount from svelte` (reads file as string, asserts no match for `import.*onMount.*from.*['"]svelte['"]`)
- `microphone.svelte.ts: does not invoke start() from $effect or $effect.pre` (reads file as string, asserts no match for escaped `\$effect(?:\.pre)?` containing `start()`)

**Stream cleanup:**

- `createMicrophoneState: destroy() calls stop() on every MediaStreamTrack` (mock stream with `vi.fn()` on each track's stop)
- `createMicrophoneState: destroy() cancels the rAF handle` (spy on `cancelAnimationFrame`)
- `createMicrophoneState: track.stop() is not called more than once per track during stop-then-destroy sequence`

### Client-project browser tests — `src/lib/audio/microphone.browser.spec.ts` (client vitest project, Chromium)

These tests require real browser globals (`localStorage`, `sessionStorage`) and must NOT run in the server (Node) vitest project, where those APIs are absent and a spy-based assertion would pass vacuously. Verify that the file name routes to the client project per `vitest.config.ts` include/exclude globs.

- `detectPitch: never writes to localStorage during a detection pass` (spy on `localStorage.setItem`, assert no call during detection)
- `detectPitch: never writes to sessionStorage during a detection pass` (spy on `sessionStorage.setItem`, assert no call during detection)
- `createMicrophoneState: createSubscriber bridge wires permissionStatus.onchange at effect time, not at factory construction` (assert `navigator.permissions.query` is not called synchronously during factory construction)

### Component tests — `src/lib/components/microphone-permission.svelte.test.ts` (client vitest project, Chromium, vitest-browser-svelte)

- `MicrophonePermission: idle state renders role="status" with aria-live="polite"`
- `MicrophonePermission: requesting state renders role="status" with aria-live="polite"`
- `MicrophonePermission: allowed state renders role="status" with aria-live="polite"`
- `MicrophonePermission: denied state renders role="alert" with aria-live="assertive"`
- `MicrophonePermission: unavailable state renders role="alert" with aria-live="assertive"`
- `MicrophonePermission: renders non-empty visible text description in all five states (no icon-only state)` (assert `textContent.trim().length > 0` for each state)
- `MicrophonePermission: idle state renders accessible text "Microphone off"`
- `MicrophonePermission: requesting state renders accessible text "Requesting microphone access…"`
- `MicrophonePermission: allowed state renders accessible text "Microphone active"`
- `MicrophonePermission: denied state renders accessible text "Microphone access denied. Allow access in browser settings."`
- `MicrophonePermission: unavailable state renders accessible text "Microphone is not available in this browser."`
- `MicrophonePermission: Enable Microphone button has aria-disabled in requesting state`
- `MicrophonePermission: Enable Microphone button is focusable in idle state`
- `MicrophonePermission: Stop button is focusable and has an accessible name in allowed state`

### Playwright specs — `e2e/microphone.e2e.ts`

All specs navigate to `/microphone` (served URL; never `/(spike)/microphone`). Permission states are automated via `browserContext.grantPermissions(['microphone'])` for allow and `context.clearPermissions()` for deny. The unavailable state uses `page.addInitScript(() => { delete (navigator as any).mediaDevices; })`. Stream cleanup specs require `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream` Chrome flags configured in `playwright.config.ts`.

- `[e2e] microphone spike view: Enable Microphone button and permission status are visible at phone width (390×844)` (no layout overflow AND button visible AND status region visible)
- `[e2e] microphone spike view: Enable Microphone button and permission status are visible at tablet width (768×1024)` (same)
- `[e2e] microphone spike view: Enable Microphone button and permission status are visible at desktop width (1280×800)` (same)
- `[e2e] microphone spike view: Enable Microphone button is Tab-reachable from page landmark`
- `[e2e] microphone spike view: Enable Microphone button activatable with Enter key`
- `[e2e] microphone spike view: aria-live region is present and labeled`
- `[e2e] microphone spike view: diagnostic buffer table renders with zero rows before microphone is enabled` (navigate without granting permissions; assert table/list present but empty)
- `[e2e] permission granted: status region contains "Microphone active" after grantPermissions`
- `[e2e] permission denied: status region contains "Microphone access denied" after clearPermissions + deny`
- `[e2e] permission unavailable: status region contains "Microphone is not available" when mediaDevices deleted`
- `[e2e] stream cleanup on navigation: all mic tracks reach readyState "ended" after navigating away` (requires fake device flag)
- `[e2e] stream cleanup on Stop button: track.readyState becomes "ended" after clicking Stop` (requires fake device flag)
- `[e2e] privacy: diagnostic buffer contains at least one event before localStorage privacy check` (pre-condition: assert at least one table row is visible before checking storage—confirms detection actually ran)
- `[e2e] privacy: no localStorage key contains Float32Array data after a detection session`
- `[e2e] uncertain detection: events with uncertain flag render with a distinct label in the diagnostic buffer` (inject a mock `MicrophoneFeasibilityEvent` with `uncertain: true` via `page.addInitScript`, assert rendered row contains text `uncertain` or has a distinguishable data attribute)

### Manual / documented observations (recorded in `docs/spikes/microphone-feasibility.md`)

These produce entries in the findings artifact, not test assertions. The findings artifact template requires:

| Field                                                                          | Example                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------- |
| Primary device model and OS                                                    | MacBook Pro M3, macOS 15, built-in microphone     |
| Secondary device (if available)                                                | iPhone 15, iOS 18, Safari                         |
| Tone source name and version                                                   | getSynth() oscillator, Vibratone build SHA abc123 |
| Chrome desktop — allow, deny, unavailable, cleanup                             | Pass / Fail + notes                               |
| Second browser (Firefox or Safari desktop) — allow, deny, unavailable, cleanup | Pass / Fail + actual threshold values             |
| Latency p50 and p95 (Chrome)                                                   | **\_ ms / _** ms                                  |
| Cents error median over 50 tones (Chrome)                                      | \_\_\_ cents                                      |
| Octave-error rate over 50 tones (Chrome)                                       | \_\_\_ %                                          |
| Cents error median over 50 tones (second browser)                              | \_\_\_ cents                                      |
| Octave-error rate over 50 tones (second browser)                               | \_\_\_ %                                          |
| Noisy-room clarity and octave-error rate                                       | **\_ / _** %                                      |
| Mobile browser latency (if available)                                          | \_\_\_ ms                                         |
| Battery / tab suspension observation                                           | pass/note                                         |
| GO / NO-GO conclusion                                                          | GO or NO-GO + failing metric if NO-GO             |

---

## Verification

Run all four gates before marking the milestone complete:

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

AP-claims guard:

```
grep -rE "perfect pitch|guaranteed|will learn" src/
```

Must return no matches, including `src/routes/(spike)/microphone/+page.svelte`.

Manual gates:

- Manual microphone allow, deny, unavailable, and cleanup smoke on Chrome desktop.
- Manual smoke on Firefox desktop or Safari desktop (at least one additional browser); record actual threshold values.
- Confirm `docs/spikes/microphone-feasibility.md` is committed and contains the GO/NO-GO conclusion with actual measured values, reference device, and tone source.

---

## Non-Goals

- Do not build the AP drill curriculum, FSRS scheduling, or any learner-facing drill surface.
- Do not display pitch-detection output anywhere except the spike developer view.
- Do not implement onset detection, beat tracking, rhythm analysis, or any time-based microphone scoring. These are deferred until latency and onset timing have been explicitly measured on real devices and recorded.
- Do not persist raw audio, `AudioBuffer` samples, `Float32Array` data, or `MediaStream` tracks anywhere.
- Do not make the GO/NO-GO decision before the full manual smoke matrix (Chrome + at least one additional browser with all four numeric thresholds met) is recorded in the findings artifact.
- Do not ship this spike view in the main AP trainer navigation. The `(spike)` route group exists precisely to keep it isolated.
- Do not build the lookahead scheduler, note sequences, or sample loading. Those belong to separate milestones.
- Do not introduce accounts, a database, cloud sync, or teacher workflows.
- Do not implement `visibilitychange` or `beforeunload` stream cleanup. These require service-worker or `pagehide` patterns not in scope here. Defer to a future hardening milestone.
- Do not add a `+layout.server.ts` or `load` function to the spike route. It is purely client-side.
- Do not add context wiring (`getMicrophoneState`/`setMicrophoneState`) to `microphone.svelte.ts`. The factory result is passed as a prop—context is only warranted when a deeply nested subtree needs it.

---

## Completion Signal

This milestone is complete when:

1. `bun run check`, `bun run lint`, `bun run test:unit -- --run`, and `bun run test:e2e` all pass.
2. All named unit tests, component tests, and Playwright specs in the Test Plan exist and pass.
3. The `microphone-permission.svelte` component stub is implemented and covers all five permission states with correct ARIA attributes and exact announced text strings.
4. `docs/spikes/microphone-feasibility.md` is committed and contains: the five GO/NO-GO thresholds, actual measured values across ≥ 50 sustained tones using the documented tone source, the primary device model and OS, the device/browser matrix (Chrome + at least one other with all four numeric thresholds met), and a definitive GO or NO-GO conclusion.
5. If **GO**: the findings file records this result. Milestone 08 (AP Singing and Pitch Production) may include sing-back prompts, pitch-production scoring, and clarity-gated attempt classification. Milestone 11 (Relative Pitch and Singer Track) may include scale-degree singing, pocket-mode microphone drills, and ear-to-voice transfer exercises.
6. If **NO-GO**: the findings file records the specific failing metric and its measured value. A follow-up milestone is opened via `gh issue create`, referencing the failing row and its measured value. Both milestone 08 (AP Singing and Pitch Production) and milestone 11 (Relative Pitch and Singer Track) exclude all singing and pitch-production features until that follow-up milestone resolves the failing metric. Milestones 04, 05, 06, 07, 09, 10, 12, and all later milestones are unaffected.
