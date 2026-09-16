# 14. Staff Notation Exercises

## Outcome

A learner who has completed key-signature and scale-construction drills (from Milestone 13) can now practice note, interval, scale, and chord construction on a rendered music staff using keyboard input alone. Every staff exercise has a fully functional non-visual equivalent—using the piano-keyboard or letter-button answer surfaces from Milestone 10—so blind and low-vision musicians are never excluded from any drill introduced here.

## Product Requirements

- Install **VexFlow** (`bun add vexflow`). Notation is confirmed in scope (Milestone 00). The renderer decision is resolved here: VexFlow is selected. abcjs and OSMD are explicitly not installed in this milestone. Rationale: VexFlow exposes a programmatic TypeScript API (construct `Stave`, `StaveNote`, `Beam` objects from data) that maps directly to `NotationEvent[]`, has the longest maintenance track record among the candidates, and does not require MusicXML parsing or ABC-string serialization.

- Implement four staff construction exercises: note placement, interval construction, scale construction, and chord construction.

- Every staff exercise renders on a VexFlow staff **and** has a fully functional piano-keyboard or letter-button non-visual answer surface (from Milestone 10/Milestone 13) so the drill can be completed without interacting with the staff SVG.

- All VexFlow calls are isolated to `src/lib/learning/notation/`; no Vibratone feature code imports VexFlow directly outside that directory.

- This milestone retires Milestone 13's no-staff grep gate and replaces it with the positive assertions in the Verification section.

**Clef and answer-comparison semantics (resolved, not deferred):**

- Treble clef only. Bass clef is a non-goal for this milestone.
- Answer comparison is pitch-class-only: octave is displayed on the staff but not graded, consistent with the existing AP note trainer.
- Enharmonic equivalence: C# and Db are accepted as the same answer, reusing `pitchClassEquals()` from Milestone 00.
- Staff renders black keys with sharp spelling by default; flat spelling is used when the key context specifies a flat key signature (e.g., Bb major renders Bb, not A#).

**Kill criterion:** If fewer than 10% of active users who completed at least one theory explorer session (Milestone 13) open a staff exercise within 30 days of Milestone 14 launch, treat staff construction exercises as an unvalidated investment and pause further staff work (sight-reading, dictation) before beginning the next staff milestone.

## User Experience Requirements

- Staff exercise pages live at `/theory/staff`. URL params `?type=`, `?tonic=`, and `?mode=` seed the exercise, mirroring Milestone 13's drill route pattern. The "Practice on staff" link from any theory explorer navigates to the staff route with the selected tonic and mode pre-seeded.

- Every theory explorer that had a "Practice" link (Milestone 13) now also has a "Practice on staff" link alongside it.

- The staff SVG is an enhancement. The keyboard answer surface is always visible and operable. A learner who cannot perceive the staff can complete any drill via piano-keyboard or letter buttons.

- Audio playback is triggered only by direct user gesture (click, Enter, or Space). Never on mount, hover, or focus.

- Staff exercises do not emit a scoring event on mount. Only explicit user answer submission triggers scoring.

- Correct/incorrect feedback is communicated as visible text alongside any color indicator—never color alone.

- Responsive layout is required at 375px, 768px, and 1280px widths. On narrow viewports (375px), the staff container scrolls horizontally (`overflow-x: auto`)—it is never clipped.

- Do not set `export const ssr = false` on staff exercise routes. SSR must remain on so the text-equivalent fallback is present in initial HTML for screen readers. The renderer is isolated from SSR via dynamic import inside the attachment lifecycle (see Architecture Targets).

## Data and Analytics Requirements

- Staff-surface drill attempts extend Milestone 13's `ConstructionDrillMeta` type with two additional fields and are stored under the existing `vibratone:construction-meta:v1` key. No new `localStorage` keys are introduced.

**Extended `ConstructionDrillMeta`** (adds to the M13 type in `src/lib/learning/analytics/construction-meta-log.ts`):

```ts
// Extends the existing ConstructionDrillMeta type from Milestone 13.
// Staff-surface attempts additionally populate:
//   answerSurface: 'staff'  (new value alongside 'keyboard' | 'text-buttons' | 'midi')
//   rendererVersion: string // VexFlow package version, e.g. "4.2.1"; undefined for non-staff surfaces
//
// The drillType union in ConstructionDrillMeta is extended:
//   drillType: 'key-signature' | 'scale-construction'         // M13 values
//            | 'note-on-staff' | 'interval-on-staff'          // M14 additions
//            | 'scale-on-staff' | 'chord-on-staff'            // M14 additions
```

The frozen `AttemptEvent` shape from Milestone 00 is **not modified**. Construction-drill attempt events (via `appendAttemptEvent`) continue to use `vibratone:attempts:v1`; the extended `ConstructionDrillMeta` is the parallel per-attempt metadata log.

- Populate `rendererVersion` from VexFlow's version export at drill completion time.
- Non-staff attempts record `rendererVersion: undefined`; staff attempts record a non-null string.
- Zero outbound network requests fire during any staff exercise session.

## Accessibility Requirements

- Every rendered staff has an accessible text description. The staff container carries `role="img"` and an `aria-label` listing all notated note names (e.g., "Staff notation: C4 quarter note, E4 quarter note, G4 quarter note"). A visually-hidden `<span class="sr-only">` with the same content is present in DOM during SSR, before the VexFlow renderer hydrates.

- Every staff exercise has a fully functional non-visual answer path: the piano-keyboard or letter-button answer surface (from Milestone 10) is always present and keyboard-navigable, independent of the staff SVG. A keyboard-only user can complete any staff exercise without reading the staff SVG.

- Correct/incorrect feedback is announced via `aria-live="assertive"` on answer submission, the same pattern as Milestone 13 construction drills.

- Each answer button exposes `aria-pressed` reflecting selection state.

- Tab order on staff exercise pages covers all interactive elements in logical reading order. Focus is not trapped inside the staff container.

- All new routes pass Playwright responsive smoke at 375px / 768px / 1280px.

- No staff-notation-specific a11y work lands on M13 routes—those remain unchanged.

## Module and Architecture Targets

### Learning engine (`src/lib/learning/notation/`) — new directory

This directory is new in M14. It must not be re-exported from any barrel index outside this directory.

| File                                           | Action     | Contents                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/learning/notation/types.ts`           | **Create** | `NotationEvent` type stub (used until Octavian #27 ships): `{ id: string; label: string; pitchClass: number; octave: number; duration: string; accidental: 'sharp' \| 'flat' \| 'natural' \| 'none' }`. `NotationAdapter` interface: `render(container: HTMLElement, events: NotationEvent[]): void; destroy(): void`.                                                                                                         |
| `src/lib/learning/notation/notation-event.ts`  | **Create** | `toNotationEventStub(input: Note \| Chord \| Scale): NotationEvent[]` — local stub using `music.ts` lookup tables; returns hardcoded events sufficient to drive VexFlow. `export const NOTATION_API_READY = false` feature flag. When Octavian #27 ships, flip the flag and the stub is replaced with the real call; call sites are unchanged.                                                                                 |
| `src/lib/learning/notation/vexflow-adapter.ts` | **Create** | `createVexFlowAdapter(): NotationAdapter` — concrete VexFlow implementation. Top-level `import` of VexFlow lives **here only**; this file is loaded exclusively via dynamic `import()` inside component attachments, never at module init time. `render()` creates `Renderer`, `Stave`, `StaveNote[]` from `NotationEvent[]`. Sets `container.dataset.rendered = 'true'` after paint, enabling deterministic Playwright waits. |

### Learning engine extensions

| File                                                  | Action     | Contents                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/learning/drills/schema.ts`                   | **Extend** | Add `'note-on-staff' \| 'interval-on-staff' \| 'scale-on-staff' \| 'chord-on-staff'` to the `drillType` union in `DrillConfig`. Add `answerSurface: 'staff'` to the union alongside `'keyboard' \| 'text-buttons' \| 'midi'`.                                                                    |
| `src/lib/learning/drills/construction.ts`             | **Extend** | Add `generateNoteOnStaffDrill(tonicPc, octave?): DrillPrompt[]`; `generateIntervalOnStaffDrill(rootPc, intervalQuality): DrillPrompt[]`; `generateScaleOnStaffDrill(tonicPc, mode): DrillPrompt[]`; `generateChordOnStaffDrill(rootPc, quality): DrillPrompt[]`. Pure functions, no I/O.         |
| `src/lib/learning/analytics/construction-meta-log.ts` | **Extend** | Add `rendererVersion?: string` to `ConstructionDrillMeta`. Extend `drillType` union. Populate `rendererVersion` from VexFlow's version export on staff-surface attempts; leave `undefined` for keyboard/text-button surfaces.                                                                    |
| `src/lib/learning/protocols/theory.ts`                | **Extend** | Add `NOTATION_ENABLED = true` constant (notation is confirmed in scope; no conditional). Add `resolveStaffExercise(type: StaffExerciseType, tonicPc: number, mode: string): { events: NotationEvent[]; textEquivalent: string }`. Extend `createTheoryState()` with `activeStaffExercise` field. |

### Components (`src/lib/components/`) — flat, kebab-case, consistent with M13

| File                                               | Action     | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/staff-notation-display.svelte` | **Create** | Container that mounts the VexFlow renderer via `{@attach}` on a `<div role="img">`. Accepts `events: NotationEvent[]` and `textEquivalent: string` as props. Dynamic `import()` of `vexflow-adapter.ts` fires inside the attachment's `$effect` body (client-only, never SSR). `$effect` re-runs `adapter.render()` reactively when `events` changes. Wrapped in `<svelte:boundary>` with a `{#snippet failed}` that renders the text-equivalent fallback when the renderer fails. Renders a `<span class="sr-only">` with `textEquivalent` at all times (present in SSR HTML). |
| `src/lib/components/staff-exercise-card.svelte`    | **Create** | Wraps `<staff-notation-display>` with the exercise prompt, audio playback control, correctness feedback (`aria-live="assertive"`), and the answer surface. Mirrors the structure of `practice-card.svelte`.                                                                                                                                                                                                                                                                                                                                                                     |
| `src/lib/components/staff-answer-surface.svelte`   | **Create** | Thin wrapper that selects the appropriate M10 answer surface (piano keyboard or letter buttons) based on current answer-surface setting. Emits pitch-class answer event. Keyboard-only path never requires reading the staff. Each answer button exposes `aria-pressed`.                                                                                                                                                                                                                                                                                                        |

**SSR invariant:** `vexflow-adapter.ts` is imported exclusively via dynamic `import()` inside component attachment bodies. It is never imported at the top level of any `.svelte` or `.ts` file that participates in SSR. `bun run check` must pass with zero errors; any top-level reference to `window`, `document`, `HTMLElement`, or `SVGElement` in the notation module is a blocking error.

**Attachment pattern (canonical):**

```svelte
<!-- src/lib/components/staff-notation-display.svelte -->
<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type { NotationEvent } from '$lib/learning/notation/types';

	interface Props {
		events: NotationEvent[];
		textEquivalent: string;
	}

	let { events, textEquivalent }: Props = $props();

	const notation: Attachment = (container) => {
		let adapter: import('$lib/learning/notation/types').NotationAdapter | null = null;

		$effect(() => {
			let cancelled = false;
			import('$lib/learning/notation/vexflow-adapter').then((m) => {
				if (cancelled) return;
				adapter ??= m.createVexFlowAdapter();
				adapter.render(container, events);
				container.dataset.rendered = 'true';
			});
			return () => {
				cancelled = true;
			};
		});

		return () => {
			adapter?.destroy();
			delete container.dataset.rendered;
		};
	};
</script>

<svelte:boundary>
	<div class="notation-container" role="img" aria-label={textEquivalent} {@attach notation}>
		<span class="sr-only">{textEquivalent}</span>
	</div>

	{#snippet failed(error)}
		<div class="notation-fallback" role="alert">
			<p>Staff notation unavailable.</p>
			<p class="notation-text">{textEquivalent}</p>
		</div>
	{/snippet}
</svelte:boundary>
```

The dynamic `import()` lives inside the `$effect` body—not after an `await` at the attachment scope. This keeps `$effect` synchronous at creation time (avoiding `effect_orphan`) and makes the effect reactive to `events` changes. The `cancelled` flag prevents stale renders if the attachment is destroyed before the import resolves.

### SvelteKit routes (`src/routes/theory/staff/`)

All routes are universal (no `+page.server.ts`). No server-side data dependencies. Route pattern mirrors M13's `theory/drill/` with query params — not a dynamic `[exercise]` segment — so the "Practice on staff" URL handoff from explorer pages is consistent.

| File                                   | Action     | Contents                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/theory/staff/+page.svelte` | **Create** | Staff exercise drill runner. Reads `StaffExerciseParams` from the load function. Renders the appropriate construction exercise component.                                                                                                                                              |
| `src/routes/theory/staff/+page.ts`     | **Create** | Universal `load`: reads `?type=`, `?tonic=`, `?mode=` search params; validates `type` against `StaffExerciseType` union; returns `StaffExerciseParams` + `{ events: NotationEvent[]; textEquivalent: string }` from `resolveStaffExercise()`. Invalid params return `error(400, ...)`. |

```ts
// StaffExerciseParams (in src/routes/theory/staff/+page.ts)
type StaffExerciseType =
	'note-on-staff' | 'interval-on-staff' | 'scale-on-staff' | 'chord-on-staff';

type StaffExerciseParams = {
	type: StaffExerciseType;
	tonicPc: number;
	mode: 'major' | 'natural-minor';
};
```

### Files extended from M13

| File                                       | Action                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/theory/[concept]/+page.svelte` | Add "Practice on staff" link alongside the existing "Practice" link. Points to `/theory/staff?type=<matching-drill-type>&tonic=<pc>&mode=<mode>`. |

### Bundle isolation

`src/lib/learning/notation/` must **not** be re-exported from any barrel index outside that directory. VexFlow appears only in `vexflow-adapter.ts`, behind a dynamic `import()`. Post-build: VexFlow must not appear in the main client entry chunk; it appears only in the lazy chunk loaded when `/theory/staff` is first visited.

## Dependencies

- **Milestone 13 (Theory Explorers and Natural-Language Drill Builder):** provides `DrillConfig` (with `key-signature` and `scale-construction` drill types), `ConstructionDrillMeta` and `appendConstructionMeta` (extended here), `createTheoryState()` / `getTheoryState()` context (staff routes inherit the theory layout), `src/routes/theory/+layout.svelte` (staff routes live inside this layout tree), `keySignatureAccidentals()` and `chordPitchClasses()` music helpers, `scale-builder-answer.svelte` (reused as the non-visual answer surface for scale-on-staff), and the construction drill route architecture at `src/routes/theory/drill/`. This is the direct prior milestone; M10 and M12 infrastructure is consumed transitively through M13.

No dependency on Milestone 15 or any later milestone. No database. No auth.

## External Dependency Contracts

| Capability                              | Owner                                                              | Contract needed                                                                                                                                                                                                                     | Stub/mock plan                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer-neutral notation serialization | [Octavian #27](https://github.com/stevekinney/octavian/issues/27)  | `toNotationEvent(input: Note \| Chord \| Scale): NotationEvent[]` where `NotationEvent = { id: string; label: string; pitchClass: number; octave: number; duration: string; accidental: 'sharp' \| 'flat' \| 'natural' \| 'none' }` | `toNotationEventStub()` in `src/lib/learning/notation/notation-event.ts` builds event arrays from M13's `music.ts` lookup tables (reuses `keySignatureAccidentals`, `chordPitchClasses`). `const NOTATION_API_READY = false` flag. Flip to `true` when #27 ships; all call sites route through `notation-event.ts` and need no changes. No staff exercise is blocked by this dependency. |
| VexFlow notation renderer               | [VexFlow npm](https://github.com/0xfe/vexflow) (`bun add vexflow`) | `import { Renderer, Stave, StaveNote, Voice, Formatter } from 'vexflow'` — programmatic stave and note construction                                                                                                                 | No stub needed. VexFlow is a real npm package installed in `dependencies`. If dynamic import fails at runtime, `staff-notation-display.svelte`'s `<svelte:boundary>` fallback renders the `textEquivalent` string with a "staff notation unavailable" message.                                                                                                                           |
| Note naming and enharmonic labels       | [Octavian #18](https://github.com/stevekinney/octavian/issues/18)  | `getNoteNames(pc: PitchClass, system: 'sharp' \| 'flat'): string` for constructing VexFlow note-name strings                                                                                                                        | Already stubbed in M13's `keySignatureAccidentals()` in `music.ts`. Reuse the same stub for staff note labels in `notation-event.ts`. Replace internals when #18 ships; call sites unchanged.                                                                                                                                                                                            |
| Chord spellings and inversions          | Octavian core (`octavian@3.0.0`)                                   | `chord.notes` array for constructing multi-note staff entries                                                                                                                                                                       | Already available. No stub needed.                                                                                                                                                                                                                                                                                                                                                       |
| Scale pitch classes                     | Octavian core (`octavian@3.0.0`)                                   | `scale.pitchClasses` array for constructing scale runs on staff                                                                                                                                                                     | Already available. No stub needed.                                                                                                                                                                                                                                                                                                                                                       |
| Notation layout component               | [Cinder #324](https://github.com/stevekinney/cinder/issues/324)    | A card/panel component for staff exercises                                                                                                                                                                                          | Use existing Cinder `Card` + `Button` primitives. Migrate to the dedicated component when it lands.                                                                                                                                                                                                                                                                                      |

## Acceptance Criteria

Each criterion is a concrete pass/fail check with at least one named verifying test.

1. **VexFlow isolation.** No Vibratone feature file imports VexFlow directly outside `src/lib/learning/notation/`. All VexFlow calls go through `vexflow-adapter.ts`. Verified by: `grep -rE "from 'vexflow'" src/ | grep -v "src/lib/learning/notation"` must return no matches.

2. **M13 grep-gate retired.** M13's no-staff grep gate (`grep -rE "VexFlow|abcjs|opensheet|staff-notation" src/` must return no matches) is superseded by this milestone. The positive replacement gate in the Verification section confirms VexFlow is wired.

3. **Staff renders correct note.** The `staff-notation-display.svelte` component renders a VexFlow staff containing exactly the prompt note for each of the 12 chromatic pitch classes. Verified by `src/lib/components/staff-notation-display.svelte.test.ts` → `renders a single C4 note event as an SVG StaveNote` and `renders each of the 12 chromatic pitch classes without throwing`.

4. **Staff renders correct interval.** Given a root note and interval type, `staff-notation-display` renders both notes on the staff with correct pitch names. Verified by `src/lib/components/staff-notation-display.svelte.test.ts` → `renders major third above C as C4 and E4`.

5. **Staff renders correct scale.** The scale-on-staff drill renders exactly 7 pitch classes in ascending order for each of the 12 major tonics. Verified by `src/lib/learning/drills/construction.spec.ts` → `generateScaleOnStaffDrill: produces 7 ordered notes for G major` and `produces 7 ordered notes for F# major`.

6. **Staff renders correct chord.** The chord-on-staff drill renders all chord tones simultaneously on staff for triads and seventh chords. Verified by `src/lib/components/staff-notation-display.svelte.test.ts` → `renders C major triad as C4, E4, G4 simultaneously on staff`.

7. **Non-visual alternative always present.** Every staff exercise page renders a fully functional piano-keyboard or letter-button answer surface operable by keyboard-only and screen-reader users, independent of the staff SVG. Verified by `e2e/staff-notation.spec.ts` → `keyboard-only: complete note-on-staff drill without interacting with staff SVG`.

8. **SSR safety.** Importing `src/lib/learning/notation/notation-event.ts` or `src/lib/learning/notation/types.ts` in a Node/server environment does not throw. VexFlow is not imported at module init time. Verified by `src/lib/learning/notation/notation-event.spec.ts` → `module can be imported in a server environment without throwing`; and by `bun run check` exiting clean.

9. **Staff SVG accessible text description.** Every rendered staff has a non-empty `aria-label` and a matching `<span class="sr-only">` listing all notated note names. Verified by `src/lib/components/staff-notation-display.svelte.test.ts` → `staff container has descriptive aria-label listing all rendered note names` and `sr-only span is non-empty and matches aria-label`.

10. **No audio or scoring event on mount.** Staff exercise components do not play audio or emit a scoring event on mount. Only explicit user action triggers either. Verified by `src/lib/components/staff-exercise-card.svelte.test.ts` → `renders without playing audio or emitting a scoring event on mount`.

11. **ConstructionDrillMeta renderer version.** Staff-surface attempts record a non-null `rendererVersion` string in `ConstructionDrillMeta`. Non-staff attempts record `rendererVersion: undefined`. Verified by `src/lib/learning/analytics/construction-meta-log.spec.ts` → `staff-surface attempt includes non-null rendererVersion` and `keyboard-surface attempt omits rendererVersion`.

12. **Attempt written to existing key.** Staff exercises write to `vibratone:construction-meta:v1`, not a new key. Verified by `src/lib/learning/analytics/construction-meta-log.spec.ts` → `staff drill attempt writes to vibratone:construction-meta:v1, not a new key`.

13. **Explorer-to-staff handoff.** Every theory explorer that had a "Practice" link (M13) now has a "Practice on staff" link. Navigating to the staff drill URL pre-seeds the correct tonic and mode. Verified by `e2e/staff-notation.spec.ts` → `scale explorer: Practice on staff link navigates to staff drill pre-seeded with selected tonic`.

14. **Bundle isolation.** VexFlow does not appear in the main application bundle. Verified by: `bun run build && grep -r "VexFlow" .svelte-kit/output/client/_app/immutable/entry/` must return no matches. VexFlow appears only in the lazy chunk for `/theory/staff`.

15. **Local-only.** Zero network requests to non-localhost origins fire during any staff exercise session. Verified by `e2e/staff-notation.spec.ts` → `no non-localhost network requests during staff exercise session` using `page.route()` interception.

16. **Responsive smoke.** Staff exercise pages render without layout overflow or hidden interactive elements at 375px, 768px, and 1280px. At 375px, the staff container scrolls horizontally rather than clipping. Verified by responsive smoke in `e2e/staff-notation.spec.ts`.

17. **Enharmonic equivalence accepted.** C# and Db are accepted as correct answers for pitch class 1 on any staff drill. Verified by `src/lib/learning/notation/notation-event.spec.ts` → `pitchClassEquals: C# and Db both accepted for pitch-class 1`.

18. **No AP-claims copy.** No UI string introduced in M14 contains "perfect pitch", "guaranteed", or "will learn". Verified by inherited grep gate from M00.

19. **No sight-reading or dictation surfaces.** No M14 route or component renders a melody to be read or transcribes a heard melody. Verified by code-review grep: `grep -rE "sight-reading|dictation" src/routes/theory/staff/` must return no matches.

## Test Plan

### Unit tests

**`src/lib/learning/notation/notation-event.spec.ts`** (AC-8, AC-17)

- `module can be imported in a server environment without throwing`
- `toNotationEventStub: returns an array with at least one NotationEvent for a C major triad`
- `toNotationEventStub: every returned event has id, label, pitchClass, octave, duration, accidental fields`
- `toNotationEventStub: C4 returns pitchClass 0, octave 4, accidental "none"`
- `toNotationEventStub: C#4 returns pitchClass 1, accidental "sharp"`
- `toNotationEventStub: Db4 returns pitchClass 1, accidental "flat"`
- `toNotationEventStub: G major scale returns 7 events with F# accidental on the seventh`
- `toNotationEventStub: Bb major scale returns events with Bb and Eb accidentals`
- `toNotationEventStub: never throws for any valid PitchClass input 0–11`
- `pitchClassEquals: C# and Db both accepted for pitch-class 1`
- `pitchClassEquals: answer comparison ignores octave—C4 and C5 score as correct for the same pitch-class target`
- `when NOTATION_API_READY is true, toNotationEvent calls octavian toNotationEvent and not the stub`

**`src/lib/learning/notation/vexflow-adapter.spec.ts`** (AC-1, AC-8)

- `vexflow-adapter module is only imported dynamically, never at module initialization time`
- `createVexFlowAdapter: render() produces at least one SVG child element for a single note event`
- `createVexFlowAdapter: render() produces 7 child elements for a G major scale event array`
- `createVexFlowAdapter: destroy() removes all SVG children from the target element`
- `createVexFlowAdapter: calling render() twice on the same target does not duplicate SVG output`
- `createVexFlowAdapter: render() with an empty NotationEvent[] renders an empty stave without throwing`

**`src/lib/learning/drills/construction.spec.ts`** additions (AC-5)

- `generateScaleOnStaffDrill: produces 7 ordered notes for G major`
- `generateScaleOnStaffDrill: produces 7 ordered notes for F# major`
- `generateScaleOnStaffDrill: produces 7 ordered notes for Bb major`
- `generateNoteOnStaffDrill: returns a DrillPrompt for each of the 12 chromatic pitch classes`
- `generateIntervalOnStaffDrill: ascending major third from C returns [C4, E4]`
- `generateIntervalOnStaffDrill: all 12 interval qualities from C return two-note arrays without throwing`
- `generateChordOnStaffDrill: C major triad returns [C4, E4, G4]`
- `generateChordOnStaffDrill: G dominant seventh returns [G4, B4, D5, F5]`

**`src/lib/learning/analytics/construction-meta-log.spec.ts`** additions (AC-11, AC-12)

- `staff-surface attempt includes non-null rendererVersion`
- `keyboard-surface attempt omits rendererVersion (undefined)`
- `staff drill attempt writes to vibratone:construction-meta:v1, not a new key`
- `rendererVersion on staff attempt matches VexFlow package version string`

### Component tests (vitest-browser-svelte)

**`src/lib/components/staff-notation-display.svelte.test.ts`** (AC-3, AC-4, AC-6, AC-8, AC-9)

- `renders a single C4 note event as an SVG StaveNote`
- `renders each of the 12 chromatic pitch classes without throwing`
- `renders major third above C as C4 and E4`
- `renders C major triad as C4, E4, G4 simultaneously on staff`
- `renders 7 StaveNote elements for a G major scale`
- `staff container has descriptive aria-label listing all rendered note names`
- `sr-only span is non-empty and matches aria-label content`
- `staff container has role="img"`
- `no VexFlow call fires before attachment runs (module init is SSR-safe)`
- `renders empty stave without throwing when events prop is empty`
- `svelte:boundary fallback renders textEquivalent when dynamic import fails`
- `data-rendered attribute is set after paint`

**`src/lib/components/staff-exercise-card.svelte.test.ts`** (AC-10)

- `renders without playing audio or emitting a scoring event on mount`
- `correct/incorrect feedback announced via aria-live="assertive"`
- `correctness communicated as visible text, not color alone`
- `keyboard: Tab moves focus through all interactive elements`

**`src/lib/components/staff-answer-surface.svelte.test.ts`** (AC-7)

- `renders piano-keyboard or letter-button answer surface visible without staff`
- `submitted answer emits pitch-class, not absolute pitch, in the answer event`
- `answer event fires only on explicit user activation (click or Enter/Space), not on focus`
- `keyboard: Tab order is logical without requiring staff SVG interaction`
- `each answer button exposes aria-pressed reflecting selection state`

### Integration tests

**`src/lib/learning/notation/notation-event.spec.ts`** (round-trip, AC-3 through AC-6)

- `note drill: toNotationEventStub output round-trips through createVexFlowAdapter render without error for all 12 pitch classes`
- `scale drill: G major scale events render without accidental conflicts`
- `chord drill: C major triad events render with correct note positions in treble clef`
- `interval drill: all 12 interval qualities from C render without throwing`

### Playwright E2E tests

**`e2e/staff-notation.spec.ts`** (AC-7, AC-13, AC-15, AC-16, AC-18, AC-19)

_Happy paths:_

- `note-on-staff: user selects a note on the piano surface and sees it appear on staff`
- `interval-on-staff: user places second note and sees interval rendered on staff`
- `scale-on-staff: user places all 7 notes and sees full scale on staff`
- `chord-on-staff: user places triad tones and sees chord rendered on staff`
- `staff exercise: data-rendered is set before screenshot assertion`

_Non-visual alternative (AC-7):_

- `keyboard-only: complete note-on-staff drill without interacting with staff SVG`
- `keyboard-only: complete scale-on-staff drill using only Tab and Enter`
- `staff note exercise: text description of notated content is present and non-empty in DOM`
- `staff chord exercise: answer surface is reachable by Tab alone without reading the staff`

_Explorer-to-staff handoff (AC-13):_

- `scale explorer: Practice on staff link navigates to staff drill pre-seeded with selected tonic`
- `chord explorer: Practice on staff link pre-seeds chord quality in staff drill`

_Local-only (AC-15):_

- `no non-localhost network requests during staff exercise session (page.route interception)`

_No sight-reading or dictation (AC-19):_

- `staff exercise pages have no melody-reading or dictation interface elements`

_Responsive smoke (AC-16):_

- `phone 375px: staff exercise renders staff and answer surface without horizontal overflow`
- `phone 375px: staff container has overflow-x auto, not overflow hidden`
- `phone 375px: answer surface buttons are at least 44px height`
- `tablet 768px: staff and piano-keyboard answer surface both visible without scrolling`
- `desktop 1280px: full staff exercise layout displays without truncation`

_M13 regression guard:_

- `no staff SVG, canvas, VexFlow, or notation element on /theory route after M14 ships`
- `no notation element on /theory/[concept] routes`
- `no notation element on /theory/drill route`
- `no notation element on /theory/builder route`

_Bundle isolation (AC-14):_

- `VexFlow does not appear in main client entry chunk (post-build grep)`

_SSR safety:_

- `load /theory/staff with JavaScript disabled: text equivalent is present in initial HTML`
- `load /theory/staff with JavaScript disabled: no canvas or SVG notation element in static HTML`
- `load /theory/staff with JavaScript enabled: renderer loads after hydration, staff appears`

## Verification

Run in order; all must exit clean:

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

**VexFlow isolation gate (replaces M13's no-staff gate):**

```
grep -rE "from 'vexflow'" src/ | grep -v "src/lib/learning/notation"
```

Must return no matches. VexFlow is intentionally present inside `src/lib/learning/notation/`; it must not appear anywhere else.

**Notation isolation gate (no renderer leak into M13 routes):**

```
grep -rE "vexflow|VexFlow|abcjs|opensheet" src/ | grep -v "src/lib/learning/notation\|src/routes/theory/staff"
```

Must return no matches.

**VexFlow wired (positive gate, replaces M13's negative no-staff gate):**

```
grep -rE "vexflow" src/lib/learning/notation/vexflow-adapter.ts
```

Must return at least one match, confirming the renderer is wired.

**Bundle isolation gate:**

```
bun run build && grep -r "VexFlow" .svelte-kit/output/client/_app/immutable/entry/
```

Must return no matches. VexFlow must appear only in the lazy chunk for `/theory/staff`.

**No network in notation module:**

```
grep -rE "fetch\(|XMLHttpRequest" src/lib/learning/notation/
```

Must return no matches.

**No sight-reading or dictation gate:**

```
grep -rE "sight-reading|dictation" src/routes/theory/staff/
```

Must return no matches.

**AP-claims gate (inherited from M00):**

```
grep -rE "perfect pitch|guaranteed|will learn" src/
```

Must return no matches.

**Manual browser smokes:**

- Chrome: open `/theory/staff?type=scale-on-staff&tonic=0&mode=major`, complete the exercise using keyboard only (no mouse on the staff). Confirm `vibratone:construction-meta:v1` in Local Storage contains a record with `rendererVersion` non-null and `answerSurface: 'staff'`.
- Safari: same smoke; confirm VexFlow staff renders (VexFlow is an SVG renderer and works without Web MIDI).
- Responsive: manually resize to 375px, 768px, 1280px; confirm staff and answer surface both visible at each width without horizontal page scroll (staff container may scroll independently).
- Accessibility: open `/theory/staff`, enable VoiceOver or NVDA, navigate to the staff SVG container, confirm the `aria-label` reads note names aloud.
- No-JS: disable JavaScript in browser devtools, load `/theory/staff?type=note-on-staff&tonic=0`, confirm text-equivalent content appears in the HTML source.

## Non-Goals

- **Staff sight-reading and staff dictation** are explicitly out of scope for this milestone. M14 delivers only construction exercises: the learner is given a concept (note, interval, scale, chord) and constructs it on the staff. Sight-reading (read a notated melody) and dictation (transcribe a heard melody to notation) are a future milestone that depends on M14. Any route or component implementing sight-reading or dictation is a scope violation in M14.
- **abcjs and OSMD** are not evaluated, not installed. VexFlow is the selected renderer.
- **Bass clef** is not in scope. Treble clef only.
- **Free-form MusicXML import or export** is not in scope.
- **Microphone-based sight-singing** (separate concern; belongs to Milestone 08: AP Singing and Pitch Production).
- **Free-form AI theory tutoring** is Milestone 17.
- **Community content packs or shared exercise configurations** are out of scope.
- **Database, server-side state, or network egress.** All notation exercise data is local. This milestone requires no database.
- **Auth.** This milestone requires no auth. All drills are local-first.
- **Modifying the frozen `AttemptEvent` shape from Milestone 00.** Staff metadata goes in the parallel `ConstructionDrillMeta` log under `vibratone:construction-meta:v1`.
- **Re-exporting `src/lib/learning/notation/` from any barrel index** outside that directory.
- **Setting `export const ssr = false`** on any staff exercise route.

## Completion Signal

Milestone 14 is complete when:

1. `bun run check`, `bun run lint`, and `bun run test:unit -- --run` exit clean with zero new failures.
2. All named unit tests in `src/lib/learning/notation/notation-event.spec.ts`, `src/lib/learning/notation/vexflow-adapter.spec.ts`, `src/lib/learning/drills/construction.spec.ts` (additions), and `src/lib/learning/analytics/construction-meta-log.spec.ts` (additions) pass.
3. All named component tests (`staff-notation-display.svelte.test.ts`, `staff-exercise-card.svelte.test.ts`, `staff-answer-surface.svelte.test.ts`) pass.
4. All pre-existing `*.spec.ts` and `*.svelte.test.ts` tests remain green (zero regressions from M13).
5. Playwright `e2e/staff-notation.spec.ts` passes at all three responsive breakpoints.
6. The VexFlow isolation gate, notation isolation gate, VexFlow wired gate, bundle isolation gate, no-network gate, no-sight-reading gate, and AP-claims gate all pass.
7. A manual browser session on Chrome and Safari confirms: at least one staff exercise (scale-on-staff) is completable using keyboard only (no mouse on the staff SVG), VoiceOver or NVDA announces the staff `aria-label`, and `vibratone:construction-meta:v1` in Local Storage contains a correctly shaped record with non-null `rendererVersion` and `answerSurface: 'staff'`.
8. A learner who completed theory explorers in M13 can navigate to a staff exercise via the "Practice on staff" link, complete the exercise, and return to the theory hub—without any feature that requires a database, auth, or network connection.
