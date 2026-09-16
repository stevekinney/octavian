# 13. Theory Explorers and Natural-Language Drill Builder

## Outcome

A learner interested only in music theory—not AP or relative-pitch ear training—has a dedicated standalone entry point in the product. They can open the theory track, explore any of the seven supported concepts with audio playback, complete a key-signature or scale-construction drill, and see their attempt history—all without touching the AP or relative-pitch tracks.

Staff notation exercises (VexFlow, abcjs, OSMD) are out of scope here. All drills in this milestone run on the answer surfaces delivered by Milestone 10. Staff notation is Milestone 14 (Staff Notation Exercises).

## Product Requirements

- Add theory explorers for seven concepts: notes (with enharmonics), keys, scales, chords, Roman numerals, harmonic function, and cadences. Each explorer is a keyboard-navigable, audio-connected reference surface—not a timed drill. (See "Explorer Delivery Tiers" table for per-concept M13 status.)
- Add key-signature drills: the learner identifies the key signature given a tonic and mode; the answer surface is the piano keyboard or letter buttons from Milestone 10.
- Add scale-construction drills: the learner constructs a scale by selecting notes in order; order is significant (wrong-order submission counts as incorrect). The answer surface is the piano keyboard or text buttons.
- Add a natural-language drill builder: a deterministic, offline, zero-network parser that accepts a constrained free-text prompt and produces a `DrillConfig`. No LLM, no external API, no network call. In this milestone the parser accepts only `scale` and `key-signature` drill types. Prompts containing `chord` or `interval` vocabulary return a `ParseError` with the message: `"Chord and interval drills are not yet available in the builder. Supported types: scale, key signature."` A forward-looking code comment must appear at the vocabulary definition block in `parser.ts` noting that `chord` and `interval` are deferred until the builder covers those drill routes.
- Validate every NL builder output against the `DrillConfig` schema before any drill can start. The learner must confirm the parsed configuration preview before the drill begins.
- Explorer usage events and construction-drill attempt events are persisted locally only. Zero network requests fire during an explorer or drill session.

**Explorer Delivery Tiers:**

| Explorer                 | M13 Tier    | Audio                                                              | Data source                                                                                                                                               | Stub note                                                                                  |
| ------------------------ | ----------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Notes (with enharmonics) | Full        | Single-note synthesis                                              | `octavian@3.0.0` root export                                                                                                                              | —                                                                                          |
| Keys                     | Full        | Single-note tonic synthesis                                        | `keySignatureAccidentals()` in `music.ts` (hardcoded lookup, 24 entries)                                                                                  | —                                                                                          |
| Scales                   | Full        | Scale sequence via lookahead scheduler (or setTimeout stub)        | `majorScalePitchClasses()` / natural minor from `music.ts`                                                                                                | —                                                                                          |
| Chords                   | Full        | Blocked + arpeggiated via lookahead scheduler (or setTimeout stub) | `chordPitchClasses()` from `octavian@3.0.0`                                                                                                               | —                                                                                          |
| Roman Numerals           | Partial     | Chord synthesis for I–VII                                          | Hardcoded 7-degree diatonic map for C major only; other keys show "Coming soon for other keys" notice; full support deferred pending Octavian #21 and #22 | Non-C-major tonic shows a clearly labeled coming-soon message                              |
| Harmonic Function        | Placeholder | None (`CHROMATIC_HARMONY_ENABLED = false`)                         | Stub returns `'unknown'`; constant lives in `learning/protocols/theory.ts`                                                                                | Renders "Harmonic function analysis coming soon" with no broken controls or console errors |
| Cadences                 | Partial     | Multi-chord sequence via lookahead scheduler (or setTimeout stub)  | `COMMON_CADENCES` constant (authentic, plagal, deceptive, half) hardcoded in `learning/protocols/theory.ts`                                               | —                                                                                          |

**Kill criterion (measurable at this milestone's data boundary):** Within six weeks of M13 shipping to internal beta users, conduct a structured session observation with a minimum of 10 participants. If fewer than 3 of 10 participants voluntarily navigate to a theory explorer without being prompted, treat the explorer entry-point UX as an unvalidated hypothesis. Pause Milestone 14 (Staff Notation Exercises) until the theory hub layout and navigator are redesigned. Quantitative usage measurement begins at Milestone 21 (Anonymous Aggregate Efficacy).

## User Experience Requirements

- Every Full or Partial theory explorer must include at least one audio playback control. Placeholder explorers render a clearly labeled coming-soon message with no broken controls or console errors.
- Audio playback is triggered only by direct user gesture (click, Enter, or Space on a `role="button"` element). Never on mount, hover, or focus—browser autoplay policy makes silent failures likely otherwise.
- Beginners can inspect any concept without starting a timed drill. Explorers do not start a drill session, play audio, or emit a scoring event on mount.
- The NL builder displays the parsed `DrillConfig` as a structured preview panel after a valid prompt is parsed. The learner must activate a separate "Start Drill" control to begin; the Run button is disabled until the preview is shown and valid.
- Invalid NL builder prompts display a recoverable error message with a correction hint (e.g., an example of a valid prompt). Keyboard focus moves to the error region on rejection via `await tick()` after the error node is rendered.
- The active tonic and mode are preserved in the URL query string (`?tonic=7&mode=major`) so explorer state is shareable and back-button safe. The concept identity is the route path segment (`/theory/scales`), not a query param. These two together—path + query—are the single canonical source of state; no `$state` duplicates them.
- Moving from an explorer to a construction drill preserves context via URL search parameters. The "Practice this" link on (e.g.) the scales explorer navigates to `/theory/drill?type=scale-construction&tonic=7&mode=major`; the drill `+page.ts` load function reads these params and returns a `DrillConfig` (or `null` on invalid params). No shared mutable store, no `sessionStorage`.
- Explorer, drill, and builder pages are fully keyboard navigable without a mouse.
- Responsive layout is required at 375px, 768px, and 1280px widths for all new routes.

**Baseline explorer contract (all seven must satisfy or explicitly declare deviation):**

1. Renders the concept name and a one-sentence description.
2. Renders the relevant notes, intervals, or chords on the piano keyboard answer surface (from Milestone 10).
3. Full/Partial explorers: provides at least one audio playback control that plays the concept's audio representation. Placeholder explorers: renders a clearly labeled coming-soon message instead.
4. Provides a direct link or button to start a related construction drill—only where a drill exists in M13. Keys explorer links to key-signature drill; Scales explorer links to scale-construction drill. Chords, Roman numerals, cadences, and harmonic function display "Drills coming soon" instead of a broken link.
5. Is fully keyboard navigable: Tab through interactive elements, Enter/Space activate play.
6. Active tonic and mode are reflected in URL query params; concept identity is the route path.

**Per-explorer deviations from baseline:**

- **Cadence explorer (Partial):** requires multi-chord audio via the lookahead scheduler. Single-note playback is not sufficient. The audio must play the full cadence sequence in order. Uses `CADENCE_SCHEDULER_ENABLED` feature flag; falls back to setTimeout stub when real scheduler is unavailable.
- **Roman-numeral explorer (Partial):** displays chord function labels (T, S, D) alongside chord quality in C major only. Non-C-major tonic selection renders a clearly labeled "Coming soon for other keys" notice.
- **Harmonic-function explorer (Placeholder):** renders "Harmonic function analysis coming soon" with no audio control, no console errors, and no broken UI.

## Data and Analytics Requirements

Explorer usage events are distinct from scored drill attempt events. They are stored under a separate `localStorage` key so they do not pollute the frozen `AttemptEvent` log.

**`ExplorerUsageEvent`** (new, stored under `vibratone:explorer-usage:v1`):

```ts
export type ExplorerUsageEvent = {
	concept:
		'notes' | 'keys' | 'scales' | 'chords' | 'roman-numerals' | 'harmonic-function' | 'cadences';
	action: 'viewed' | 'played-example' | 'navigated-to-drill';
	durationMs: number;
	timestamp: number;
	sessionId: string; // sourced from SESSION_ID exported by src/lib/learning/drills/attempt-log.ts
};
```

The `'viewed'` action fires on component **unmount** (route leave), not on mount. `durationMs` is the elapsed time from mount to unmount, minimum 0. No event fires on mount.

**`DrillBuilderEvent`** (new, stored under `vibratone:drill-builder:v1`):

```ts
export type DrillBuilderEvent = {
	rawPrompt: string;
	parsedConfig: DrillConfig | null;
	validationResult: 'accepted' | 'rejected';
	rejectionReason: string | null;
	timestamp: number;
	sessionId: string; // sourced from SESSION_ID in attempt-log.ts
};
```

**`ConstructionDrillMeta`** (additional metadata stored under `vibratone:construction-meta:v1`; separate from the frozen `AttemptEvent` at `vibratone:attempts:v1`):

```ts
export type ConstructionDrillMeta = {
	promptId: string; // e.g. "scale-construction:7:major"
	drillType: 'key-signature' | 'scale-construction';
	tonicPc: number; // 0–11
	mode: 'major' | 'natural-minor';
	expectedAnswer: PitchClass[]; // integers 0–11; NOT serialized strings
	submittedAnswer: PitchClass[]; // integers 0–11; NOT serialized strings
	correct: boolean; // true only if order and content both match
	responseTimeMs: number;
	answerSurface: 'keyboard' | 'text-buttons' | 'midi';
	timestamp: number;
	sessionId: string; // sourced from SESSION_ID in attempt-log.ts
};
```

`expectedAnswer` and `submittedAnswer` are `PitchClass[]` (integers 0–11), not serialized strings. Enharmonic equivalence is resolved at score-time in `construction.ts`—the meta record stores pitch-class integers, which are inherently enharmonic-agnostic. This is distinct from the frozen `AttemptEvent.answer` field, which remains a serialized string.

All storage is local. Zero outbound network requests fire at any point. Do not track a notation renderer version—staff exercises are not in scope for this milestone.

## Accessibility Requirements

- All explorer pages: full Tab-order keyboard navigation through concept selector and play controls; Enter/Space activates play.
- `scale-builder-answer.svelte`: each scale-degree button exposes `aria-pressed` state; the answer surface has a visible focus ring at all responsive widths.
- `drill-builder-form.svelte`: validation errors rendered in an `aria-live="polite"` region so screen readers announce them without focus disruption. Keyboard focus moves programmatically to the error region on rejection using `await tick()` before `errorRegionEl?.focus()` — this ensures the node exists in the DOM before focus is requested.
- Construction drill feedback: correct/incorrect state announced as `aria-live="assertive"` (brief, high-priority feedback on answer submission). Correctness must be communicated as visible text, not color alone.
- Harmonic-function placeholder: the coming-soon message has no broken controls, no unreachable focus targets, and no console errors.
- All new route groups pass Playwright responsive smoke at 375px / 768px / 1280px.
- No staff-notation-specific accessibility requirements in this milestone—those belong to Milestone 14.

## Module and Architecture Targets

### Learning engine (`src/lib/learning/`)

The M00 drill schema (`DrillConfig`, `AttemptEvent`, `isDrillConfig`) is inherited through Milestone 10. M13 extends the schema and creates new modules:

**`src/lib/learning/drills/schema.ts` — Extend**

Add these optional fields to `DrillConfig` (backward-compatible; all M00 note-trainer usage unaffected):

```ts
export type TheoryDrillType = 'key-signature' | 'scale-construction';

// DrillConfig is extended with optional theory fields — present only for theory construction drills.
// drillType absent → M00 note-trainer drill. drillType present → tonicPc and mode required.
export type DrillConfig = {
	drillId: string; // 'key-signature' | 'scale-construction' | note-trainer id
	seed?: string;
	eligiblePitchClasses: PitchClass[];
	octaveLo: number;
	octaveHi: number;
	timbre: string;
	// M13 extension — undefined for non-theory drills
	drillType?: TheoryDrillType;
	tonicPc?: PitchClass; // 0–11; required when drillType is defined
	mode?: 'major' | 'natural-minor'; // required when drillType is defined
};

// Updated isDrillConfig: when drillType is present, validate tonicPc (0–11) and mode.
export function isDrillConfig(value: unknown): value is DrillConfig {
	if (typeof value !== 'object' || value === null) return false;
	const c = value as Record<string, unknown>;
	const baseValid =
		typeof c.drillId === 'string' &&
		Array.isArray(c.eligiblePitchClasses) &&
		typeof c.octaveLo === 'number' &&
		typeof c.octaveHi === 'number' &&
		typeof c.timbre === 'string';
	if (!baseValid) return false;
	if (c.drillType !== undefined) {
		if (c.drillType !== 'key-signature' && c.drillType !== 'scale-construction') return false;
		if (typeof c.tonicPc !== 'number' || c.tonicPc < 0 || c.tonicPc > 11) return false;
		if (c.mode !== 'major' && c.mode !== 'natural-minor') return false;
	}
	return true;
}
```

| File                                                         | Action     | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/learning/drills/schema.ts`                          | **Extend** | Add `TheoryDrillType` union; extend `DrillConfig` with optional `drillType`, `tonicPc`, `mode`; update `isDrillConfig` guard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/lib/learning/drills/construction.ts`                    | **Create** | `generateKeySignatureDrill(tonicPc, mode): DrillPrompt[]`; `generateScaleConstructionDrill(tonicPc, mode): DrillPrompt[]`; `evaluateScaleAnswer(submitted: PitchClass[], expected: PitchClass[]): boolean`; `evaluateKeySignatureAnswer(submitted: PitchClass[], expected: PitchClass[]): boolean`. Pure functions; no I/O. Scale-construction scoring is order-significant (position-by-position pitch-class comparison). Key-signature scoring is order-insensitive set comparison (the learner selects the accidental pitch classes in any order via the piano keyboard; both sides are sorted before comparison). `createConstructionDrillState().submit()` delegates to these pure functions based on `config.drillType`. |
| `src/lib/learning/drills/construction-drill-state.svelte.ts` | **Create** | `createConstructionDrillState(config: DrillConfig): ConstructionDrillState`; `ConstructionDrillState` type; `[getConstructionDrillState, setConstructionDrillState]` context pair. See state architecture section for full public surface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/lib/learning/drills/drill-builder/parser.ts`            | **Create** | `parseDrillPrompt(raw: string): ParseResult`. Accepted types: `scale`, `key-signature`. `chord` and `interval` are recognized tokens but immediately return `ParseError`. No `fetch`, no `async`, no LLM.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/lib/learning/drills/drill-builder/schema-validator.ts`  | **Create** | `validateDrillConfig(config: unknown): ValidationResult` wrapping `isDrillConfig` from `schema.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/lib/learning/drills/drill-builder/state.svelte.ts`      | **Create** | `createDrillBuilderState()` factory + context pair. `run()` is absent—factory exposes `drillUrl: string \| null` derived; component calls `goto(state.drillUrl)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `src/lib/learning/protocols/theory.ts`                       | **Create** | Pure data functions only—no runes, no `svelte` import: `isTheoryTrackEnabled(): boolean`; `keySignatureAccidentals(tonicPc, mode): string[]`; `chordPitchClasses(rootPc, quality): PitchClass[]`; `romanNumeralLabel(scaleDegree, quality): string`; seven explorer data helpers; `COMMON_CADENCES` constant; `CHROMATIC_HARMONY_ENABLED = false` feature flag; `CADENCE_SCHEDULER_ENABLED` feature flag.                                                                                                                                                                                                                                                                                                                      |
| `src/lib/learning/protocols/theory-state.svelte.ts`          | **Create** | `createTheoryState()` factory with `$state`/`$derived` (non-URL state only: `isPlaying: boolean`, `lastPlayedConcept` for telemetry); `TheoryState` type; `[getTheoryState, setTheoryState]` context pair. **`activeTonicPc` is NOT in this factory**—it derives from the URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/lib/learning/analytics/explorer-log.ts`                 | **Create** | `appendExplorerUsageEvent(event: ExplorerUsageEvent): void`; `loadExplorerUsageLog(): ExplorerUsageEvent[]`—`localStorage` under `vibratone:explorer-usage:v1`; same defensive-wrapper + malformed-JSON recovery pattern as `persistence.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/lib/learning/analytics/drill-builder-log.ts`            | **Create** | `appendDrillBuilderEvent(event: DrillBuilderEvent): void`; `loadDrillBuilderLog(): DrillBuilderEvent[]`—`localStorage` under `vibratone:drill-builder:v1`; same defensive-wrapper pattern                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/lib/learning/analytics/construction-meta-log.ts`        | **Create** | `appendConstructionMeta(meta: ConstructionDrillMeta): void`; `loadConstructionMeta(): ConstructionDrillMeta[]`—`localStorage` under `vibratone:construction-meta:v1`; same defensive-wrapper pattern                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### SvelteKit routes (`src/routes/theory/`)

All routes are universal (no `+page.server.ts`). No server-side data dependencies.

```
src/routes/theory/
  +layout.svelte          ← Instantiates createTheoryState(); calls setTheoryState()
  +page.svelte            ← Theory hub: links to all seven explorer concepts and to the builder
  [concept]/+page.svelte  ← Per-concept explorer (concept slug = notes | keys | scales | chords |
                            roman-numerals | harmonic-function | cadences)
  drill/
    +page.svelte          ← Key-signature and scale-construction drill runner
    +page.ts              ← Universal load(): reads ?type=&tonic=&mode= params, returns { config: DrillConfig | null }
  builder/
    +page.svelte          ← NL drill builder UI
    (no +page.ts — delete or omit; +page.svelte alone creates the route)
```

**`/theory/drill/+page.ts` load function:**

```ts
import type { PageLoad } from './$types';
import type { DrillConfig } from '$lib/learning/drills/schema';

export const load: PageLoad = ({ url }) => {
	const type = url.searchParams.get('type') as 'key-signature' | 'scale-construction' | null;
	const rawTonic = Number(url.searchParams.get('tonic') ?? '0');
	const mode = (url.searchParams.get('mode') ?? 'major') as 'major' | 'natural-minor';

	const tonic = Number.isInteger(rawTonic) && rawTonic >= 0 && rawTonic <= 11 ? rawTonic : 0;

	const config: DrillConfig | null =
		type === 'key-signature' || type === 'scale-construction'
			? {
					drillId: type,
					drillType: type,
					tonicPc: tonic,
					mode: mode === 'natural-minor' ? 'natural-minor' : 'major',
					eligiblePitchClasses: [],
					octaveLo: 4,
					octaveHi: 4,
					timbre: 'sine'
				}
			: null;

	return { config };
};
```

If `config` is `null` (missing or invalid params), the drill page renders a "Choose a drill" fallback panel—not an error state or a redirect. This handles malformed params gracefully in both SSR and client-side navigation.

### Components (`src/lib/components/`)

New files following existing kebab-case convention:

| File                           | Purpose                                                                                                              | Props interface                                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theory-explorer-card.svelte`  | Concept card with play button, label, and "Practice" link (where drill exists); satisfies baseline explorer contract | `{ concept: ExplorerConcept; onplayrequest: () => void }` where `ExplorerConcept = { slug: string; label: string; description: string; pitchClasses: PitchClass[]; tier: 'full' \| 'partial' \| 'placeholder' }` |
| `key-signature-display.svelte` | Visual key-signature surface (accidentals as text labels, no staff)                                                  | `{ tonicPc: PitchClass; mode: 'major' \| 'natural-minor'; accidentals: string[] }`                                                                                                                               |
| `scale-builder-answer.svelte`  | Step-by-step scale-construction answer surface; keyboard navigable; uses callback prop                               | `{ scale: PitchClass[]; onComplete: (submitted: PitchClass[]) => void }` — no `createEventDispatcher`                                                                                                            |
| `drill-builder-form.svelte`    | Textarea + parse-result preview card + validation error list; accepts state as prop for testability                  | `{ state: DrillBuilderState }`                                                                                                                                                                                   |
| `drill-config-preview.svelte`  | Read-only structured preview of parsed `DrillConfig`; shown before Run is enabled                                    | `{ config: DrillConfig }` — no callbacks                                                                                                                                                                         |

`ExplorerConcept` and `DrillBuilderState` (= `ReturnType<typeof createDrillBuilderState>`) must be exported from their respective modules and re-exported from `src/lib/learning/drills/index.ts`.

### State architecture

**URL is the single source of truth for tonic and mode.** `activeTonicPc` is never a `$state` field. It is a `$derived` in each `[concept]/+page.svelte`:

```ts
// src/routes/theory/[concept]/+page.svelte (script block)
import { page } from '$app/state';
import { goto } from '$app/navigation';

const activeTonicPc = $derived(Number(page.url.searchParams.get('tonic') ?? '0'));
const activeMode = $derived(
	(page.url.searchParams.get('mode') ?? 'major') as 'major' | 'natural-minor'
);

function selectTonic(pc: number): void {
	const url = new URL(page.url);
	url.searchParams.set('tonic', String(pc));
	goto(url, { keepFocus: true, noScroll: true, replaceState: true });
}
```

`replaceState: true` prevents browser-history pollution. `keepFocus: true` + `noScroll: true` are required for AC-14 (keyboard-only happy path).

**Theory layout** (`src/routes/theory/+layout.svelte`): instantiates `createTheoryState()` (non-URL state only) and distributes it via `setTheoryState()`. Theory routes must never call `getPracticeState()`.

**NL drill builder state** (`src/lib/learning/drills/drill-builder/state.svelte.ts`):

```ts
export function createDrillBuilderState() {
	let rawPrompt = $state('');
	const parseResult = $derived(parseDrillPrompt(rawPrompt));
	const parsedConfig = $derived(parseResult.success ? parseResult.config : null);
	const validationErrors = $derived(parsedConfig ? validateDrillConfig(parsedConfig) : []);
	const canRun = $derived(parsedConfig !== null && validationErrors.length === 0);

	// drillUrl is derived — the component calls goto(state.drillUrl). No goto() inside the factory.
	const drillUrl = $derived.by(() => {
		if (!parsedConfig) return null;
		const params = new URLSearchParams({
			type: parsedConfig.drillType ?? '',
			tonic: String(parsedConfig.tonicPc ?? 0),
			mode: parsedConfig.mode ?? 'major'
		});
		return `/theory/drill?${params.toString()}`;
	});

	return {
		get rawPrompt() {
			return rawPrompt;
		},
		set rawPrompt(v: string) {
			rawPrompt = v;
		},
		get parsedConfig() {
			return parsedConfig;
		},
		get validationErrors() {
			return validationErrors;
		},
		get canRun() {
			return canRun;
		},
		get drillUrl() {
			return drillUrl;
		}
	};
}
```

`parseDrillPrompt` is a pure synchronous function; per-character re-evaluation is acceptable. Deriveds are lazy and do not execute until their result is read. Do not add debouncing pre-emptively.

**Construction drill runner** — new factory, new context pair. Does **not** import or reuse `createPracticeState()`:

```ts
// src/lib/learning/drills/construction-drill-state.svelte.ts
import { createContext } from 'svelte';
import type { DrillConfig } from './schema';
import type { PitchClass } from '$lib/music';
import { evaluateScaleAnswer, evaluateKeySignatureAnswer } from '$lib/learning/drills/construction';
import { appendConstructionMeta } from '$lib/learning/analytics/construction-meta-log';
import { SESSION_ID } from '$lib/learning/drills/attempt-log';

export type ConstructionDrillPhase = 'idle' | 'answering' | 'revealed';
export type ConstructionDrillState = ReturnType<typeof createConstructionDrillState>;

const [getConstructionDrillState, setConstructionDrillState] =
	createContext<ConstructionDrillState>();
export { getConstructionDrillState, setConstructionDrillState };

export function createConstructionDrillState(config: DrillConfig) {
	let phase = $state<ConstructionDrillPhase>('idle');
	let submittedNotes = $state<PitchClass[]>([]);
	let expectedNotes = $state<PitchClass[]>([]);
	let correct = $state<boolean | null>(null);
	let startedAt = $state<number | null>(null);
	let responseTimeMs = $state<number | null>(null);
	let autoAdvanceTimer: ReturnType<typeof setTimeout> | undefined;

	function clearTimer() {
		if (autoAdvanceTimer !== undefined) {
			clearTimeout(autoAdvanceTimer);
			autoAdvanceTimer = undefined;
		}
	}

	function addNote(pc: PitchClass): void {
		if (phase !== 'answering') return;
		submittedNotes = [...submittedNotes, pc];
	}

	function removeLastNote(): void {
		if (phase !== 'answering' || submittedNotes.length === 0) return;
		submittedNotes = submittedNotes.slice(0, -1);
	}

	function start(expected: PitchClass[]): void {
		expectedNotes = expected;
		submittedNotes = [];
		correct = null;
		responseTimeMs = null;
		startedAt = Date.now();
		phase = 'answering';
	}

	function submit(): void {
		if (phase !== 'answering') return;
		const elapsed = startedAt !== null ? Date.now() - startedAt : 0;
		responseTimeMs = elapsed;
		// Delegate to pure scoring functions from construction.ts.
		// Scale construction: order-significant. Key signature: order-insensitive set match.
		correct =
			config.drillType === 'scale-construction'
				? evaluateScaleAnswer(submittedNotes, expectedNotes)
				: evaluateKeySignatureAnswer(submittedNotes, expectedNotes);
		phase = 'revealed';
		appendConstructionMeta({
			promptId: `${config.drillType}:${config.tonicPc}:${config.mode}`,
			drillType: config.drillType!,
			tonicPc: config.tonicPc!,
			mode: config.mode!,
			expectedAnswer: expectedNotes,
			submittedAnswer: submittedNotes,
			correct: correct,
			responseTimeMs: elapsed,
			answerSurface: 'keyboard',
			timestamp: Date.now(),
			sessionId: SESSION_ID
		});
	}

	function reset(): void {
		phase = 'idle';
		submittedNotes = [];
		correct = null;
		responseTimeMs = null;
		startedAt = null;
	}

	function destroy(): void {
		clearTimer();
	}

	return {
		get config() {
			return config;
		},
		get phase() {
			return phase;
		},
		get submittedNotes() {
			return submittedNotes;
		},
		get expectedNotes() {
			return expectedNotes;
		},
		get correct() {
			return correct;
		},
		get responseTimeMs() {
			return responseTimeMs;
		},
		start,
		addNote,
		removeLastNote,
		submit,
		reset,
		destroy
	};
}
```

Instantiated in `/theory/drill/+page.svelte`:

```svelte
<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		createConstructionDrillState,
		setConstructionDrillState
	} from '$lib/learning/drills/construction-drill-state.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	// data.config is DrillConfig | null; render fallback if null.
	const state = data.config
		? setConstructionDrillState(createConstructionDrillState(data.config))
		: null;
	onDestroy(() => state?.destroy());
</script>
```

Similarly, `createTheoryState().destroy()` must be called `onDestroy` in `+layout.svelte` to cancel any pending scheduler events.

### SSR safety invariants

- No `localStorage`, `AudioContext`, `window`, or `document` at module initialization time. Use `localStorageOrNull()` from `persistence.ts` for all storage access.
- Static theory content (scale formulas, key-signature counts, chord spellings) renders correctly on the server via synchronous Octavian calls.
- `getSynth()` returns `null` on server; guard every playback call inside event handlers, as in the existing `practice-card.svelte` pattern.
- `CHROMATIC_HARMONY_ENABLED = false` and `CADENCE_SCHEDULER_ENABLED` are module-level constants in `theory.ts`—safe to read on server.

### NL builder parser spec

**Accepted drill types (M13 only):** `scale`, `key signature`.

**Recognized-but-rejected drill types:** `chord`, `interval`. These tokens are recognized to produce a targeted error, not treated as unknown input.

**Allowed vocabulary:**

- Drill types accepted: `scale`, `key signature`
- Drill types recognized-but-rejected: `chord`, `interval` → `ParseError: "Chord and interval drills are not yet available in the builder. Supported types: scale, key signature."`
- Root notes: all standard note names including enharmonics (`C`, `Db`, `C#`, `D`, `Eb`, `E`, `F`, `Gb`, `F#`, `G`, `Ab`, `G#`, `A`, `Bb`, `B`)
- Quality modifiers: `major`, `minor`, `diminished`, `augmented`, `dominant`, `half-diminished`
- Direction (scales): `ascending`, `descending`
- Count: integer 1–50 preceded by a digit (e.g., `10 rounds`)

**Parser behavior:**

- Extract drill type, root, quality, direction, and count from free text using keyword match against the allowed vocabulary.
- Drill type missing → reject: "Please specify a drill type: scale or key signature."
- Drill type is `chord` or `interval` → reject: "Chord and interval drills are not yet available in the builder. Supported types: scale, key signature."
- Root note missing → reject: "Please specify a root note."
- Multiple drill types in one prompt → reject: "Ambiguous drill type. Please specify only one: scale or key signature."
- Multiple quality keywords with no clear winner → reject: "Ambiguous quality. Please specify only one (e.g., major, minor)."
- Quality absent for scale → default to major; display the inferred value in the config preview.
- Digit token adjacent to a note name (e.g., `D7`, `V7`) → the digit is not parsed as a count; the token is not a valid root name.
- Successful parse → display parsed `DrillConfig` preview panel; learner must confirm before drill begins.
- All successful parses produce output that passes `isDrillConfig`.

**Hard constraint:** No `fetch`, no `async`, no LLM call anywhere in `parser.ts`. Pure synchronous TypeScript testable with zero browser globals.

### Each-block keying convention

For scale-degree arrays where all pitch classes are guaranteed distinct, use pitch class as key:

```svelte
{#each scale as pc (pc)}
	<NoteChip {pc} />
{/each}
```

For chord or cadence arrays where a pitch class may repeat (e.g., first-inversion triads, seventh chords), use a composite index key:

```svelte
{#each chordNotes as pc, i (`${i}:${pc}`)}
	<NoteChip {pc} position={i} />
{/each}
```

`scale-builder-answer.svelte` uses the pitch-class key (scale degrees guaranteed distinct). `theory-explorer-card.svelte` chord rendering uses the composite key.

### Octavian wrapper strategy

Extend `src/lib/music.ts` with new helpers (wrapping Octavian or using local stubs where issues are unshipped):

| Helper                                                                                     | Octavian dep                       | Stub if unshipped                                                                             |
| ------------------------------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `keySignatureAccidentals(tonicPc: PitchClass, mode: 'major' \| 'natural-minor'): string[]` | #18                                | Hardcoded 24-entry lookup table (12 major + 12 natural-minor) in `music.ts`                   |
| `chordPitchClasses(rootPc: PitchClass, quality: ChordQuality): PitchClass[]`               | core (already in `octavian@3.0.0`) | n/a                                                                                           |
| `romanNumeralLabel(scaleDegree: number, quality: ChordQuality): string`                    | #21, #22                           | Hardcoded 7-degree map for C major; non-C-major keys return `null` and trigger coming-soon UI |

## Dependencies

- **Milestone 10 (Answer Surfaces, MIDI, and Accessibility):** provides the configurable answer surfaces (piano keyboard, letter buttons, solfege), keyboard-shortcut answer input, the accessibility infrastructure (focus-ring patterns, `aria-live` conventions, responsive breakpoints), and the M00 drill schema types (`DrillConfig`, `AttemptEvent`, `isDrillConfig`, `appendAttemptEvent`) that theory explorers and construction drills build on. The `DrillConfig` type is extended here with new optional fields; the `AttemptEvent` shape is not modified.
- **Milestone 12 (Intervals and Chords as Supporting Skills):** provides the chord data functions (`chordPitchClasses`, chord quality types) consumed by the chord and Roman-numeral explorers. The NL builder's recognized vocabulary is designed to eventually extend to chord/interval drill types when M12 drill routes are available.

## External Dependency Contracts

| Capability                              | Owner                                                                                       | Contract                                                                                                                                 | Stub/mock plan                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Note naming, solfege, enharmonic labels | [Octavian #18](https://github.com/stevekinney/octavian/issues/18)                           | `getNoteNames(pc: PitchClass, system: 'sharp' \| 'flat' \| 'solfege' \| 'scale-degree'): string`                                         | Extend `noteLabel()` in `music.ts`; `'solfege'`: `['Do','Di','Re','Ri','Mi','Fa','Fi','Sol','Si','La','Li','Ti']`; `'scale-degree'`: `['1','♭2','2','♭3','3','4','♯4','5','♭6','6','♭7','7']`. Key-signature accidentals use hardcoded 24-entry lookup in `keySignatureAccidentals()`. |
| Chromatic harmony / harmonic function   | [Octavian #21](https://github.com/stevekinney/octavian/issues/21)                           | `chordFunction(chord, key): HarmonicFunction`                                                                                            | `CHROMATIC_HARMONY_ENABLED = false` constant in `theory.ts`; stub returns `'unknown'`; harmonic-function explorer shows Placeholder coming-soon message                                                                                                                                |
| Chord progressions / Roman numerals     | [Octavian #22](https://github.com/stevekinney/octavian/issues/22)                           | `generateProgression(key, pattern): Chord[]`                                                                                             | `COMMON_CADENCES` constant (`{ name: string; chords: PitchClass[][] }[]`) hardcoded in `theory.ts`; Roman-numeral map hardcoded for 7 diatonic degrees in C major only                                                                                                                 |
| Musical symbol parsing                  | [Octavian #29](https://github.com/stevekinney/octavian/issues/29)                           | `parseMusicalSymbol(input: string): ParsedSymbol \| null`                                                                                | NL parser uses handwritten allowlist map; no Octavian call required for constrained vocabulary                                                                                                                                                                                         |
| Notation-friendly serialization         | [Octavian #27](https://github.com/stevekinney/octavian/issues/27)                           | `toNotationEvent(...)`                                                                                                                   | Not needed in M13. Documented as a Milestone 14 dependency only.                                                                                                                                                                                                                       |
| Multi-note sequence scheduler           | `src/lib/audio/scheduler.ts` (internal capability; not yet extracted as a separate package) | `scheduleSequence(notes: Array<{ frequencyHz: number; startOffsetSec: number; durationSec: number }>, audioContext: AudioContext): void` | `CADENCE_SCHEDULER_ENABLED` flag in `theory.ts`. Stub: `notes.forEach(n => setTimeout(() => synth.play(n.frequencyHz), n.startOffsetSec * 1000))`. When the real scheduler is available, import directly and flip the flag.                                                            |
| Explorer layout component               | [Cinder #324](https://github.com/stevekinney/cinder/issues/324)                             | Card/panel with accessible play controls and concept header                                                                              | Use existing Cinder `Card` + `Button` primitives; migrate to dedicated explorer-panel when issue lands                                                                                                                                                                                 |
| M10 answer surfaces                     | Milestone 10                                                                                | Piano keyboard and letter-button answer surface components with `onguess: (pc: PitchClass) => void` callback prop                        | If M10 routes are not yet merged at M13 start, stub a local `<KeyboardAnswerSurface>` accepting the same prop interface; replace on merge                                                                                                                                              |

## Acceptance Criteria

Each criterion is a concrete pass/fail check with ≥1 named verifying test.

1. **Explorer audio (Full and Partial tiers).** Every Full or Partial theory explorer page contains at least one keyboard-accessible play control that plays audio on user gesture. Placeholder explorers render a clearly labeled coming-soon message with no broken controls or console errors. Verified by `e2e/theory-explorers.spec.ts` → for each Full/Partial concept: `[concept]: play button triggers Synth.play without console errors`; for the harmonic-function placeholder: `harmonic-function explorer: renders coming-soon message with no console errors`.

2. **Explorer URL state.** Every theory explorer's active tonic and mode are reflected in the URL query string. The concept identity is the route path. Navigating directly to `?tonic=2&mode=major` renders D major without user interaction. Verified by `e2e/theory-explorers.spec.ts` → `scale explorer: navigating with ?tonic=2 pre-selects D major without interaction`.

3. **Explorer event type.** Explorer usage events have a distinct event type from scored drill attempt events. Verified by `src/lib/learning/analytics/explorer-log.spec.ts` → `appendExplorerUsageEvent writes to vibratone:explorer-usage:v1, not vibratone:attempts:v1`.

4. **No audio on mount.** Theory explorer components do not play audio or emit a scoring event on mount. Verified by `src/lib/components/theory-explorer-card.svelte.test.ts` → `renders concept without playing audio or emitting a scoring event on mount`.

5. **NL builder offline.** The NL builder parser makes zero network calls. Verified by `src/lib/learning/drills/drill-builder/parser.spec.ts` → `parseDrillPrompt runs without fetch mock`.

6. **NL builder preview gate.** Every successful NL builder parse displays the parsed `DrillConfig` preview panel; the Run button is disabled until a valid config is previewed. Verified by `src/lib/components/drill-builder-form.svelte.test.ts` → `Run button is disabled until parsedConfig is non-null and validation passes` and `e2e/drill-builder.spec.ts` → `valid prompt shows config preview before run`.

7. **NL builder rejection focus.** Every NL builder rejection displays an error message and moves keyboard focus to the error region (via `await tick()`). Verified by `e2e/drill-builder.spec.ts` → `invalid prompt error message receives keyboard focus`.

8. **NL builder schema gate.** No drill starts from NL builder output that has not passed `validateDrillConfig`. `canRun` is `false` when `validationErrors` is non-empty. Verified by `src/lib/learning/drills/drill-builder/schema-validator.spec.ts` → `validateDrillConfig returns non-empty errors for config missing drillType`.

9. **Construction drill attempt shape.** Key-signature and scale-construction drills produce `ConstructionDrillMeta` records with `expectedAnswer` and `submittedAnswer` as `PitchClass[]` (integers 0–11), and all required fields. Verified by `src/lib/learning/analytics/construction-meta-log.spec.ts` → `appendConstructionMeta persists all required fields with expectedAnswer as PitchClass[]`.

10. **No staff surfaces.** No staff-notation SVG, canvas, VexFlow, abcjs, or OSMD element is present on any M13 route. Verified by `e2e/theory-explorers.spec.ts` → `no staff notation element present on any explorer or drill page`.

11. **Local-only storage.** Zero network requests to non-localhost origins during any explorer or construction-drill session. Verified by `e2e/theory-explorers.spec.ts` → `no non-localhost network requests during explorer and drill session` (using `page.route()` interception).

12. **Explorer-to-drill handoff.** Moving from any theory explorer to its corresponding construction drill (keys → key-signature drill; scales → scale-construction drill) preserves tonic and mode as URL params. Verified by `e2e/theory-explorers.spec.ts` → `scale explorer: Practice link navigates to drill pre-seeded with the selected tonic`.

13. **Responsive smoke.** Theory hub, all explorer pages, the construction drill, and the NL builder render without overflow at 375px, 768px, and 1280px. Verified by responsive smoke tests in `e2e/theory-explorers.spec.ts` and `e2e/drill-builder.spec.ts`.

14. **Keyboard-only happy path.** A keyboard-only user can complete the NL builder happy path (type prompt, read config panel, activate Start Drill) using only Tab, Enter, and arrow keys. Verified by `e2e/drill-builder.spec.ts` → `keyboard-only: NL builder happy path with Tab and Enter only`.

15. **SSR safety.** The `/theory` route renders the explorer heading in HTML with JavaScript disabled. No `localStorage`, `AudioContext`, or `window` access at module initialization. Verified by `e2e/theory-explorers.spec.ts` → `SSR: /theory route renders explorer heading in HTML with JavaScript disabled`.

16. **Construction drill scoring semantics.** Order is significant: submitting correct pitch classes in wrong ascending-scale order counts as incorrect. Verified by `src/lib/learning/drills/construction.spec.ts` → `evaluateScaleAnswer: correct pitch classes in wrong order sets correct: false`.

17. **`viewed` event lifecycle.** `ExplorerUsageEvent` with `action: 'viewed'` fires on component unmount with `durationMs >= 0`. No `'viewed'` event fires on mount. Verified by `src/lib/components/theory-explorer-card.svelte.test.ts` → `unmounting the explorer emits a viewed ExplorerUsageEvent with durationMs >= 0`.

## Test Plan

### Unit tests

**`src/lib/learning/protocols/theory.spec.ts`**

Explorer data coverage (AC-1, AC-10):

- `notes explorer: returns both enharmonic spellings for every black-key pitch class`
- `keys explorer: returns all 12 major keys`
- `keys explorer: D-flat major and C-sharp major are listed as enharmonically equivalent keys`
- `scales explorer: major scale for G returns pitch classes [7,9,11,0,2,4,6]`
- `scales explorer: natural minor scale pitch classes derive from Octavian, not hard-coded intervals`
- `chords explorer: C major triad returns pitch classes [0,4,7]`
- `chords explorer: first-inversion C major triad returns [4,7,0]`
- `chords explorer: Cmaj7 returns pitch classes [0,4,7,11]`
- `roman-numerals explorer: I chord in C major resolves to C major triad`
- `roman-numerals explorer: V7 in C major resolves to G dominant seventh`
- `roman-numerals explorer: selecting a non-C-major tonic returns null, triggering coming-soon UI`
- `cadences explorer: authentic cadence is V→I chord sequence`
- `cadences explorer: plagal cadence is IV→I chord sequence`
- `harmonic-function explorer: stub returns unknown for all inputs when CHROMATIC_HARMONY_ENABLED is false`
- `cadences explorer: playback helper calls scheduleSequence (or stub) with V→I offsets in correct temporal order`

**`src/lib/learning/drills/construction.spec.ts`**

- `generateKeySignatureDrill: returns correct accidentals for G major (1 sharp: F#)`
- `generateKeySignatureDrill: returns correct accidentals for Bb major (2 flats: Bb, Eb)`
- `generateKeySignatureDrill: returns empty accidentals for C major`
- `generateKeySignatureDrill: returns 4 sharps for E major`
- `generateKeySignatureDrill: returns all correct accidentals for all 12 major keys`
- `generateScaleConstructionDrill: returns 7 pitch classes for each of the 12 major tonics`
- `generateScaleConstructionDrill: natural minor scale pitch classes are correct for A minor`
- `evaluateScaleAnswer: accepts pitch class 1 (C#/Db) as correct when expected pc is 1 in a Db major scale (enharmonic equivalence at pc level)`
- `evaluateScaleAnswer: returns PitchClass[] (integers 0–11) in expectedAnswer and submittedAnswer fields of ConstructionDrillMeta`
- `evaluateScaleAnswer: correct pitch classes in correct ascending order sets correct: true`
- `evaluateScaleAnswer: correct pitch classes in wrong ascending-scale order sets correct: false`
- `evaluateScaleAnswer: submitting 6 of 7 correct notes sets correct: false`
- `evaluateScaleAnswer: submitting 8 pitch classes for a 7-note scale sets correct: false and submittedAnswer.length === 8 in the meta record`
- `generateScaleConstructionDrill: prompt pool excludes previous prompt when pool size > 1`
- `evaluateKeySignatureAnswer: returns true when submitted pitch classes match expected accidental pitch classes in any order (order-insensitive)`
- `evaluateKeySignatureAnswer: returns false when submitted pitch classes are a superset of expected`
- `evaluateKeySignatureAnswer: returns true for C major (empty accidentals; both arrays empty)`
- `evaluateKeySignatureAnswer: returns false when one accidental pitch class is missing`

**`src/routes/theory/drill/page.spec.ts`** (load function unit tests)

- `drill load: missing type param returns { config: null } without throwing`
- `drill load: tonic=99 clamps to 0 and returns valid DrillConfig`
- `drill load: mode=dorian returns config with mode defaulting to major`
- `drill load: mode=natural-minor is accepted and returns natural-minor DrillConfig`
- `drill load: tonic=2 and mode=major returns DrillConfig with tonicPc=2 and mode='major'`
- `drill load: tonic=NaN returns { config: null } without throwing`

**`src/lib/learning/drills/drill-builder/parser.spec.ts`**

- `parseDrillPrompt: runs without fetch mock (no network dependency)`
- `parseDrillPrompt: empty string returns ParseError with rejection reason`
- `parseDrillPrompt: unrecognized drill type returns ParseError explaining supported types`
- `parseDrillPrompt: missing root note returns ParseError requesting a root note`
- `parseDrillPrompt: "Practice C major scale ascending" returns valid DrillConfig with drillType scale, root C, quality major, direction ascending`
- `parseDrillPrompt: "10 rounds of D minor chord" returns ParseError explaining chord drills are not yet supported`
- `parseDrillPrompt: "Practice a major third ascending" returns ParseError explaining interval drills are not yet supported`
- `parseDrillPrompt: "key signature drills in G major, 20 trials" returns DrillConfig with drillType key-signature, tonic G, count 20`
- `parseDrillPrompt: missing quality for scale prompt defaults to major and sets inferredQuality flag`
- `parseDrillPrompt: all successful parses produce output that passes isDrillConfig type guard`
- `parseDrillPrompt: count below 1 returns ParseError`
- `parseDrillPrompt: count above 50 returns ParseError`
- `parseDrillPrompt: "practice C scale and key signature" with two drill types returns ParseError citing ambiguous drill type`
- `parseDrillPrompt: "D minor 7 chord" — the digit 7 is not interpreted as a repetition count`
- `parseDrillPrompt: "augmented diminished C scale" with two quality keywords returns ParseError citing ambiguous quality`
- `parseDrillPrompt: "V7 scale in C" — V7 is not in accepted root note allowlist and returns ParseError`
- `parseDrillPrompt: "C C C major scale" with repeated root returns the first matched root and notes it in the preview`

**`src/lib/learning/drills/drill-builder/schema-validator.spec.ts`**

- `validateDrillConfig: returns empty array for well-formed key-signature config`
- `validateDrillConfig: returns empty array for well-formed scale-construction config`
- `validateDrillConfig: returns non-empty errors for config missing drillType`
- `validateDrillConfig: returns non-empty errors for config with unrecognized drillType`
- `validateDrillConfig: never throws for arbitrary object input (null, undefined, string, number)`
- `isDrillConfig: returns false for null`
- `isDrillConfig: returns false for config missing drillType when drillType field is present but empty`
- `isDrillConfig: returns false for config with tonicPc=99 when drillType is set`
- `isDrillConfig: returns true for well-formed key-signature config`
- `isDrillConfig: returns true for well-formed scale-construction config`

**`src/lib/learning/analytics/explorer-log.spec.ts`** (AC-3, AC-11)

- `appendExplorerUsageEvent: writes to localStorage under vibratone:explorer-usage:v1`
- `appendExplorerUsageEvent: does NOT write to vibratone:attempts:v1`
- `loadExplorerUsageLog: returns empty array when key is absent`
- `loadExplorerUsageLog: returns previously appended events in insertion order`
- `appendExplorerUsageEvent: makes no fetch calls`
- `loadExplorerUsageLog: returns empty array when localStorage contains malformed JSON`
- `loadExplorerUsageLog: returns empty array when stored value is a JSON object (not array)`
- `loadExplorerUsageLog: skips records with missing required fields and returns remaining valid records`

**`src/lib/learning/analytics/construction-meta-log.spec.ts`** (AC-9)

- `appendConstructionMeta: persists all required fields with expectedAnswer as PitchClass[] (integers 0–11)`
- `appendConstructionMeta: persists submittedAnswer as PitchClass[] (integers 0–11), not serialized strings`
- `loadConstructionMeta: returns empty array when key is absent`
- `appendConstructionMeta: makes no fetch calls`
- `loadConstructionMeta: returns empty array when localStorage contains malformed JSON`
- `loadConstructionMeta: returns empty array when stored value is a non-array JSON type`
- `loadConstructionMeta: skips meta records missing required fields and returns valid remaining records`

**`src/lib/learning/analytics/drill-builder-log.spec.ts`**

- `appendDrillBuilderEvent: writes to vibratone:drill-builder:v1`
- `loadDrillBuilderLog: returns empty array when key is absent`
- `loadDrillBuilderLog: returns empty array when localStorage contains malformed JSON`
- `loadDrillBuilderLog: returns empty array when stored value is null or a string`

**`src/lib/music.spec.ts`** (additions to existing spec)

- `keySignatureAccidentals: returns ["F#"] for G major`
- `keySignatureAccidentals: returns ["Bb", "Eb"] for Bb major`
- `keySignatureAccidentals: returns [] for C major`
- `chordPitchClasses: returns [0, 4, 7] for C major triad`
- `chordPitchClasses: returns [0, 3, 7] for C minor triad`

**`src/lib/learning/drills/construction-drill-state.spec.ts`**

- `ExplorerUsageEvent.sessionId matches SESSION_ID from attempt-log when emitted in the same module session`
- `DrillBuilderEvent.sessionId matches SESSION_ID from attempt-log`

### Component tests (vitest-browser-svelte)

**`src/lib/components/theory-explorer-card.svelte.test.ts`** (AC-4, AC-1, AC-17)

All tests call `resetSynth()` in `afterEach` to prevent shared `Synth` singleton leaking.

- `renders concept without playing audio or emitting a scoring event on mount`
- `displays concept name and description before any user interaction`
- `play button is present, labeled, and activates audio on Enter/Space—not on focus`
- `clicking Play calls Synth.prototype.play exactly once with a frequency > 0` (spy via `vi.spyOn(Synth.prototype, 'play')`)
- `cadence play calls Synth.play (or scheduler stub) once per chord in the cadence, in non-decreasing scheduled-time order`
- `keyboard: Tab moves focus through all interactive elements in DOM order`
- `keyboard: Escape returns focus to the card entry point from a nested panel`
- `screen-reader: concept container has a descriptive aria-label or heading`
- `screen-reader: concept state change is announced via aria-live="polite"`
- `Practice link is present and points to the correct drill URL for keys and scales explorers`
- `chords and cadences explorers show "Drills coming soon" in place of a Practice link`
- `harmonic-function placeholder renders coming-soon message with no broken controls or console errors`
- `unmounting the explorer emits a viewed ExplorerUsageEvent with durationMs >= 0` (spy on `appendExplorerUsageEvent`; assert `action: 'viewed'` fires on teardown)

**`src/lib/components/drill-builder-form.svelte.test.ts`** (AC-6, AC-7, AC-8)

- `Run button is disabled when rawPrompt is empty`
- `Run button is disabled until parsedConfig is non-null and validation passes`
- `shows parsed config preview when input produces a valid DrillConfig`
- `renders validation error in an aria-live="polite" region`
- `error message includes a correction hint or example valid prompt`
- `keyboard: form fields and Run button are reachable by Tab alone`
- `keyboard: Enter on the textarea triggers parse`
- `error region receives focus after tick() when rejection occurs`

**`src/lib/components/scale-builder-answer.svelte.test.ts`**

- `renders one button per scale degree (7 for major scale)`
- `marks submitted answers as aria-pressed`
- `onComplete callback receives the submitted pitch-class array when all scale degrees are selected` (no `createEventDispatcher`; Svelte 5 callback prop)
- `is fully keyboard navigable: Tab order matches scale degree order`
- `feedback region has aria-live="assertive" attribute`
- `correct submission sets aria-live region text to a non-empty correctness announcement`
- `correct submission renders visible text containing "Correct", not only a CSS color change`
- `incorrect submission renders visible text containing "Incorrect" or "Not quite"`
- `answer surface buttons have visible focus ring at 375px viewport width`

### Integration tests

**`src/lib/learning/protocols/theory.spec.ts`** (continued, AC-12)

- `key-signature drill generates prompts for all 12 major keys without repeating until set is exhausted`
- `scale-construction drill generates prompts using Octavian scale data, not hard-coded intervals`
- `theory landing page links to all seven explorer concepts without errors`
- `URL param ?tonic=2 initializes D major without any manual state mutation`

### Playwright E2E tests

**`e2e/theory-explorers.spec.ts`** (AC-1, AC-2, AC-4, AC-10, AC-11, AC-12, AC-13, AC-15)

_SSR safety (AC-15):_

- `SSR: /theory route renders explorer heading in HTML with JavaScript disabled` (new browser context with `javaScriptEnabled: false`; assert `page.getByRole('heading', { name: /theory/i })` is visible)

_Explorer happy paths (AC-1):_

- `notes explorer: user opens explorer, activates play with keyboard; play button triggers Synth.play without console errors`
- `keys explorer: user sees "2 sharps" label for D major key signature`
- `scales explorer: user navigates all 12 tonics via keyboard`
- `scales explorer: play button triggers Synth.play without console errors`
- `chords explorer: user sees triad and seventh chord examples with names`
- `roman-numerals explorer: user sees I–VII labeled with function in C major`
- `roman-numerals explorer: selecting a non-C-major tonic shows "Coming soon for other keys" notice`
- `cadences explorer: user activates cadence play; play button triggers scheduler (or stub) without console errors`
- `harmonic-function explorer: renders coming-soon message with no console errors`

_URL state (AC-2):_

- `scale explorer: navigating with ?tonic=2 pre-selects D major without interaction`
- `user navigates back from construction drill to explorer and explorer still shows selected tonic`

_Explorer-to-drill handoff (AC-12):_

- `scale explorer: Practice link navigates to drill pre-seeded with the selected tonic`
- `keys explorer: Practice link navigates to key-signature drill pre-seeded with the selected tonic`
- `user completes a key-signature drill and sees the attempt recorded in local drill history`

_No staff surfaces (AC-10):_

- `no staff notation element (SVG canvas, VexFlow, abcjs) present on any explorer or drill page`
- `all explorer routes are fully functional with no notation renderer loaded`

_Local-only storage (AC-11):_

- `no non-localhost network requests during explorer and drill session (page.route interception)`

_Audio teardown:_

- `cadences explorer: navigating away mid-playback does not produce console audio errors`

_Aria-live feedback (AC-16):_

- `keyboard-only: aria-live="assertive" region announces correct or incorrect after scale construction submission without mouse interaction`

_Responsive smoke (AC-13):_

- `phone 375px: theory hub explorer categories are scrollable without horizontal overflow`
- `tablet 768px: explorer and drill builder render without overflow`
- `desktop 1280px: full explorer layout displays without truncation`

_Keyboard-only (AC-14):_

- `keyboard-only: user reaches every theory explorer category using Tab and Enter alone`
- `keyboard-only: user submits a scale-construction answer using keyboard alone`
- `keyboard-only: focus is not trapped in any explorer panel`

**`e2e/drill-builder.spec.ts`** (AC-5, AC-6, AC-7, AC-8, AC-13, AC-14)

_Happy path:_

- `user types "practice G minor scale descending", sees config panel showing G, minor, scale, descending, and clicks Start`
- `valid prompt shows config preview before run button is enabled`
- `Run navigates to construction drill with correct URL params`
- `navigating from scales drill to key-signature drill produces a freshly seeded config, not a cached one`

_Rejection paths (AC-7):_

- `empty input keeps Run disabled`
- `invalid prompt shows accessible error message with keyboard focus on error region`
- `user types gibberish and sees a recoverable error without page reload`
- `user types "10 rounds of D minor chord" and sees ParseError explaining chord drills are not yet supported`
- `user types "Practice a major third ascending" and sees ParseError explaining interval drills are not yet supported`

_Local-only (AC-11):_

- `no network requests during NL builder session`

_Responsive smoke (AC-13):_

- `phone 375px: prompt input and Run button visible without horizontal scroll`
- `desktop 1280px: config preview and error panel render without truncation`

_Keyboard-only (AC-14):_

- `keyboard-only: NL builder happy path with Tab and Enter only`
- `keyboard-only: user reads validation error without mouse`

## Verification

Run these gate commands in order. All must exit clean before the milestone is declared complete:

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

**No-staff assertion:**

```
grep -rE "VexFlow|abcjs|opensheet|staff-notation" src/
```

Must return no matches.

**No-network assertion (code-level):**

```
grep -rE "fetch\(|XMLHttpRequest" src/lib/learning/analytics/ src/lib/learning/drills/drill-builder/
```

Must return no matches.

**AP-claims guard (inherited from M00):**

```
grep -rE "perfect pitch|guaranteed|will learn" src/
```

Must return no matches.

**Manual browser smokes:**

- Chrome: open `/theory`, navigate through all seven explorer concepts using only keyboard, activate audio in at least three Full/Partial explorers (notes, scales, cadences), confirm no console errors, confirm harmonic-function shows coming-soon message.
- Safari: same smoke as Chrome; confirm autoplay policy is respected (audio only fires on user gesture).
- Chrome: open `/theory/builder`, type `"Practice C major scale ascending"`, confirm config preview appears, click Start, complete the drill, open DevTools → Local Storage, confirm `vibratone:construction-meta:v1` contains a record with all required fields and `expectedAnswer` is an array of integers.
- Network intercept check: open DevTools → Network tab, complete a full explorer-to-drill session, confirm zero requests to non-localhost origins.
- Responsive: manually resize to 375px, 768px, and 1280px; confirm no overflow on theory hub, a representative explorer, the construction drill, and the builder.

## Non-Goals

- Do not use an LLM or any external API for natural-language parsing. The parser is deterministic and offline.
- Do not build staff-notation exercises, install VexFlow, abcjs, or OSMD, or implement Octavian #27 (notation serialization). All of that is Milestone 14 (Staff Notation Exercises).
- Do not build a free-form theory chat or AI tutoring interface. That is Milestone 17 (AI Coach and Custom Practice).
- Do not add community content packs or shared explorer configurations.
- Do not require theory track completion before accessing the AP or relative-pitch tracks.
- Do not introduce a database, server-side state, or any network egress. All explorer usage and drill attempt data is local.
- Do not modify the frozen `AttemptEvent` shape from M00. Construction-drill metadata lives in the parallel `vibratone:construction-meta:v1` log.
- Do not make theory a required step in the AP learning path.
- Do not extend the NL builder to accept `chord` or `interval` drill types in this milestone. Those drill routes do not yet exist in M13.

## Completion Signal

Milestone 13 is complete when:

1. `bun run check`, `bun run lint`, and `bun run test:unit -- --run` exit clean with zero new failures.
2. All named unit tests in `src/lib/learning/protocols/theory.spec.ts`, `src/lib/learning/drills/construction.spec.ts`, `src/routes/theory/drill/page.spec.ts`, `src/lib/learning/drills/drill-builder/parser.spec.ts`, `src/lib/learning/drills/drill-builder/schema-validator.spec.ts`, `src/lib/learning/analytics/explorer-log.spec.ts`, `src/lib/learning/analytics/construction-meta-log.spec.ts`, and `src/lib/learning/analytics/drill-builder-log.spec.ts` pass.
3. All named component tests (`theory-explorer-card.svelte.test.ts`, `drill-builder-form.svelte.test.ts`, `scale-builder-answer.svelte.test.ts`) pass.
4. All pre-existing `*.spec.ts` and `*.svelte.test.ts` tests remain green (zero regressions).
5. Playwright `e2e/theory-explorers.spec.ts` and `e2e/drill-builder.spec.ts` pass at all three responsive breakpoints, including the SSR/no-JS spec.
6. The no-staff grep gate returns no matches.
7. The no-network grep gate returns no matches.
8. A manual browser session on Chrome and Safari confirms: all seven explorers are navigable by keyboard, audio plays on user gesture for Full/Partial explorers (not on mount), the harmonic-function placeholder shows a coming-soon message, and `vibratone:construction-meta:v1` in Local Storage contains a correctly shaped record with `expectedAnswer` as integers after completing a construction drill.
9. A learner without an AP background can reach the theory track, explore any concept, complete a key-signature or scale-construction drill, and exit—all without encountering AP-specific content.
