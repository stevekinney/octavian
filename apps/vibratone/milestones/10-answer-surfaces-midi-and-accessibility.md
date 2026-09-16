# 10. Answer Surfaces, MIDI, and Accessibility

## Outcome

A learner who plays guitar, bass, or uses a MIDI keyboard can complete a full AP drill session using their instrument's natural interface. Every answer surface—piano, guitar fretboard, bass fretboard, letter buttons, fixed-do solfege, keyboard shortcuts, or MIDI—produces identical scoring outcomes for the same musical answer. The entire core AP flow is navigable without a mouse, and screen readers announce the prompt, answer options, and feedback without silent focus traps.

## Product Requirements

- Add six answer surfaces in addition to the existing piano: guitar fretboard (6-string, standard EADGBE tuning, frets 0–12), bass fretboard (4-string, standard EADG tuning, frets 0–12), letter buttons (12 chromatic pitch-class buttons, always key-independent), fixed-do solfege buttons (Do/Di/Re/Ri/Mi/Fa/Fi/Sol/Si/La/Li/Ti—1:1 pitch-class map, no tonic context, AP-legal), keyboard shortcuts (12-key piano-row scheme defined below), and Web MIDI input (single note only, desktop progressive enhancement).
- The learner chooses a preferred answer surface in the settings panel. The choice persists to `localStorage` and is restored on page load. Switching surfaces never resets session score, streak, or FSRS card state.
- Web MIDI is gated on `'requestMIDIAccess' in navigator`. In browsers where it is absent, the MIDI option is disabled with a visible explanation. If a saved preference of `'midi'` is loaded in an unsupported browser, the app falls back silently to `'piano'` and shows a one-time notice.
- Preserve all existing piano answer behavior unchanged.
- Add beginner-facing labels to the surface selector that explain what each surface is and why a learner might choose it.
- All interactive elements in every answer surface meet a 44×44 CSS px minimum touch target.

## User Experience Requirements

- A learner can tap any pitch class on the guitar or bass fretboard and submit it as a drill answer. String labels and fret number markers are visible. Fret range defaults to 0–12 on both instruments.
- The guitar fretboard scrolls horizontally on narrow viewports; the play, replay, and submit controls remain visible without scrolling at all breakpoints.
- A learner can answer using keyboard shortcuts without taking their hands off the keyboard. The 12-key scheme maps natural white-key pitches to the home row (`A S D F G H J` → C D E F G A B) and accidentals to the row above (`W E T Y U` → C♯ D♯ F♯ G♯ A♯). This scheme is discoverable: pressing `?` during the guessing phase opens a modal dialog listing all shortcuts. The dialog is also reachable via a visible "Keyboard shortcuts" button in the surface panel.
- Switching answer surfaces mid-session is always safe: the new surface renders in the current phase with no answer pre-filled, and surface preference is persisted to `localStorage` immediately on switch.
- Phone layouts (< 640 px viewport width): the surface switcher renders as a horizontal scroll strip; the fretboard scrolls horizontally; all tappable elements meet the 44×44 px minimum.

## Data and Analytics Requirements

- `AttemptEvent` is bumped from `version: 1` to `version: 2`. The new fields are:

  ```ts
  answerSurface: AnswerSurfaceId; // which surface was active
  answerSource: 'pointer' | 'keyboard' | 'midi'; // input modality
  midiAvailable: boolean; // was Web MIDI available in this browser session
  ```

- `localStorage` key for the attempt log changes from `vibratone:attempts:v1` to `vibratone:attempts:v2`. `loadAttemptLog()` reads both keys; v1 events are re-typed read-only with defaults `answerSurface: 'piano'`, `answerSource: 'pointer'`, `midiAvailable: false`—no migration writes occur.
- MIDI device identifiers (name, manufacturer, id) are never written to any storage or attempt event at this milestone. Only `midiAvailable: boolean` is recorded.
- Keyboard shortcut usage is tracked via `answerSource: 'keyboard'` on the attempt event. No separate shortcut-specific event type is added.
- Answer equivalence is guaranteed before scoring: `pitchClassEquals(a, b)` from `src/lib/learning/drills/schema.ts` (already stubbed as `a % 12 === b % 12`) is the single equivalence check. No surface-specific scoring path exists.

## Accessibility Requirements

- All answer-surface interactive elements expose `aria-pressed` (toggle state), `aria-label` with full spoken pitch name (e.g., `"C sharp"` not `"C#"`), and `data-reveal` for correct/wrong states, matching the conventions in `piano-keyboard.svelte`.
- Fretboard fret buttons carry `aria-label="string N, fret M, pitch-name"` derived from tuning plus fret offset.
- The surface switcher uses `role="radiogroup"` with individual `role="radio"` options (or a native `<fieldset>`/`<legend>`/`<input type="radio">` group).
- The MIDI surface fallback message (when MIDI is unsupported or permission denied) renders in a `role="status"` region so it is announced by screen readers.
- The shortcut-help modal uses a native `<dialog>` element with `aria-labelledby` pointing to the dialog heading. Focus is trapped while the dialog is open. Escape closes it and returns focus to the triggering element.
- `prefers-reduced-motion`: fretboard correct/wrong highlight transitions use `transition: none` under `@media (prefers-reduced-motion: reduce)`.
- After auto-advance fires and `nextRound()` runs, focus moves programmatically to the play/replay button via a `bind:this` ref plus a `$effect` that calls `playButton?.focus()` when `state.phase` transitions from `'revealed'` to `'guessing'`. This is one of the two places a `$effect` is justified in this milestone because it is explicit imperative focus management that cannot be expressed declaratively.
- All interactive controls in the AP drill flow are reachable and operable with Tab, Arrow keys, Enter, and Space only (no mouse required).

## Module and Architecture Targets

| File                                                         | Action     | What lands there                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/learning/drills/answer-surface.ts`                  | **Create** | `AnswerSurfaceId` union; `AnswerSurfaceConfig` type; `FretboardConfig` type; `GUITAR_STANDARD_TUNING` and `BASS_STANDARD_TUNING` constants; `fretToMidiNote(openMidi: number, fret: number): number` (local stub until Octavian #19); `toFixedDoSolfege(pc: PitchClass): string` (local stub until Octavian #18); `AP_ALLOWED_SURFACES: AnswerSurfaceId[]` |
| `src/lib/learning/drills/schema.ts`                          | **Modify** | Bump `AttemptEvent.version` literal from `1` to `2`; add `answerSurface: AnswerSurfaceId`, `answerSource: 'pointer' \| 'keyboard' \| 'midi'`, `midiAvailable: boolean`                                                                                                                                                                                     |
| `src/lib/learning/drills/attempt-log.ts`                     | **Modify** | Update `loadAttemptLog()` to read both `vibratone:attempts:v1` and `vibratone:attempts:v2`; re-type v1 events with default new fields; write only to `vibratone:attempts:v2`                                                                                                                                                                               |
| `src/lib/learning/drills/index.ts`                           | **Modify** | Re-export `AnswerSurfaceId`, `FretboardConfig`, `AP_ALLOWED_SURFACES` from `answer-surface.ts`                                                                                                                                                                                                                                                             |
| `src/lib/keyboard-shortcuts.ts`                              | **Create** | `KEYBOARD_SHORTCUT_MAP: Readonly<Record<string, PitchClass>>` (12 entries, piano-row scheme); exported so shortcut-help dialog can import it independently                                                                                                                                                                                                 |
| `src/lib/midi.svelte.ts`                                     | **Create** | `MidiInput` reactive class using `createSubscriber`; exposes `available: boolean`, `ports: MIDIInput[]`, `onNote(cb: MidiNoteCallback): () => void`; `requestAccess()` is never called at module init; full SSR guard via `browser` from `$app/environment`                                                                                                |
| `src/lib/context/midi.ts`                                    | **Create** | `[getMidiInput, setMidiInput]` pair from `createContext<MidiInput>()`                                                                                                                                                                                                                                                                                      |
| `src/lib/persistence.ts`                                     | **Modify** | Add `answerSurface?: AnswerSurfaceId` (optional) to `PersistedSettings`; update `isPersistedSettings` to accept legacy payloads missing the field and to reject payloads where `answerSurface` is present but not a known `AnswerSurfaceId` value; add `answerSurface: 'piano'` to `DEFAULT_SETTINGS`                                                      |
| `src/lib/state.svelte.ts`                                    | **Modify** | Add `answerSurface` to session state (`$state`, default from loaded settings); expose `get answerSurface()` and `setAnswerSurface(id: AnswerSurfaceId): void` (persists on call); wire `guess()` to populate new `AttemptEvent` v2 fields; add `bind:this` play-button ref and `$effect` for focus-after-auto-advance                                      |
| `src/lib/components/answer-surfaces/piano-keyboard.svelte`   | **Move**   | Rename from `src/lib/components/piano-keyboard.svelte`; public API unchanged; update all import sites                                                                                                                                                                                                                                                      |
| `src/lib/components/answer-surfaces/guitar-fretboard.svelte` | **Create** | Props: `config: FretboardConfig` (default `GUITAR_STANDARD_TUNING`); reads state via `getPracticeState()`; emits `state.guess(pc)` on fret tap; `aria-label` per fret; correct/wrong reveal coloring; `@media (pointer: coarse)` touch targets; `@media (prefers-reduced-motion: reduce)` suppresses transitions                                           |
| `src/lib/components/answer-surfaces/bass-fretboard.svelte`   | **Create** | Same contract as guitar fretboard; default `BASS_STANDARD_TUNING`                                                                                                                                                                                                                                                                                          |
| `src/lib/components/answer-surfaces/letter-buttons.svelte`   | **Create** | 12 pitch-class buttons (7 naturals + 5 accidentals); `aria-label` is full spoken name; keyboard-shortcut hint rendered on each button; spells accidentals from `state.spelling`                                                                                                                                                                            |
| `src/lib/components/answer-surfaces/fixed-do-solfege.svelte` | **Create** | 12 buttons (Do/Di/Re/Ri/Mi/Fa/Fi/Sol/Si/La/Li/Ti); each button's `pc` is absolute (Do=0 always); `aria-label` includes both solfege syllable and pitch-class name                                                                                                                                                                                          |
| `src/lib/components/answer-surfaces/midi-surface.svelte`     | **Create** | Reads `getMidiInput()` context; renders connect button, device status, and note indicator; calls `state.guess(pc)` when `midi.onNote` fires; renders capability-gate fallback when `midi.available` is false (local `{#if}` block until Cinder #321 ships)                                                                                                 |
| `src/lib/components/answer-surfaces/choice-grid.svelte`      | **Create** | `<div role="group">` + `<button>` grid used by letter-buttons and solfege surfaces; local fallback until Cinder #318 ships                                                                                                                                                                                                                                 |
| `src/lib/components/surface-switcher.svelte`                 | **Create** | Horizontal scroll strip on phone, segmented control on desktop; reads `AP_ALLOWED_SURFACES` from `answer-surface.ts`; calls `state.setAnswerSurface(id)`; selected surface visually indicated; native `<fieldset>`/`<legend>`/`<input type="radio">` for accessibility                                                                                     |
| `src/lib/components/shortcut-help-dialog.svelte`             | **Create** | Native `<dialog>` element; opened by `?` keypress during guessing phase or by explicit button; lists `KEYBOARD_SHORTCUT_MAP` as a `<dl>`; focus trap; Escape closes; `<kbd>` elements as stub until Cinder #323 ships                                                                                                                                      |
| `src/routes/+page.svelte`                                    | **Modify** | Instantiate `MidiInput`, set context; register `<svelte:window onkeydown={handleShortcut} />`; render `SurfaceSwitcher`; render active surface via `$derived` registry map (`const SURFACES: Record<AnswerSurfaceId, Component> = {...}`—no `<svelte:component>`); render `ShortcutHelpDialog`                                                             |
| `e2e/answer-surfaces.e2e.ts`                                 | **Create** | All e2e answer-surface and MIDI specs                                                                                                                                                                                                                                                                                                                      |
| `e2e/accessibility.e2e.ts`                                   | **Create** | All keyboard-only navigation and responsive smoke specs                                                                                                                                                                                                                                                                                                    |

**Key type contracts:**

```ts
// src/lib/learning/drills/answer-surface.ts

export type AnswerSurfaceId =
	| 'piano'
	| 'guitar-fretboard'
	| 'bass-fretboard'
	| 'letter-buttons'
	| 'fixed-do-solfege'
	| 'keyboard-shortcuts'
	| 'midi';

export type FretboardConfig = {
	/** MIDI note numbers for each open string, low to high. */
	tuning: number[];
	fretLo: number;
	fretHi: number;
};

export const GUITAR_STANDARD_TUNING: FretboardConfig = {
	tuning: [40, 45, 50, 55, 59, 64], // E2 A2 D3 G3 B3 E4
	fretLo: 0,
	fretHi: 12
};

export const BASS_STANDARD_TUNING: FretboardConfig = {
	tuning: [28, 33, 38, 43], // E1 A1 D2 G2
	fretLo: 0,
	fretHi: 12
};

/** AP-legal surfaces only: no movable-do solfege, no scale-degree (those are relative-pitch). */
export const AP_ALLOWED_SURFACES: AnswerSurfaceId[] = [
	'piano',
	'guitar-fretboard',
	'bass-fretboard',
	'letter-buttons',
	'fixed-do-solfege',
	'keyboard-shortcuts',
	'midi'
];
```

```ts
// src/lib/keyboard-shortcuts.ts

/**
 * Maps unmodified keys to pitch classes (0=C … 11=B).
 * White keys: A S D F G H J → C D E F G A B.
 * Black keys: W E   T Y U   → C♯ D♯   F♯ G♯ A♯.
 */
export const KEYBOARD_SHORTCUT_MAP: Readonly<Record<string, PitchClass>> = {
	a: 0, // C
	w: 1, // C♯
	s: 2, // D
	e: 3, // D♯
	d: 4, // E
	f: 5, // F
	t: 6, // F♯
	g: 7, // G
	y: 8, // G♯
	h: 9, // A
	u: 10, // A♯
	j: 11 // B
} as const;
```

```ts
// AttemptEvent v2 shape (src/lib/learning/drills/schema.ts)
export type AttemptEvent = {
	version: 2;
	// ... all v1 fields preserved ...
	answerSurface: AnswerSurfaceId;
	answerSource: 'pointer' | 'keyboard' | 'midi';
	midiAvailable: boolean;
};
```

**`MidiInput` class shape** (in `src/lib/midi.svelte.ts`):

```ts
import { createSubscriber } from 'svelte/reactivity';
import { browser } from '$app/environment';

export type MidiNoteCallback = (noteNumber: number, velocity: number) => void;

export class MidiInput {
	/** Evaluated at construction time; safe on server (returns false). */
	readonly available: boolean = browser && 'requestMIDIAccess' in navigator;
	#access: MIDIAccess | null = null;
	#callbacks = new Set<MidiNoteCallback>();

	#subscribe = browser
		? createSubscriber((update) => {
				// ... async requestMIDIAccess, statechange wiring, cleanup ...
				return () => {
					/* teardown */
				};
			})
		: () => {};

	get ports(): MIDIInput[] {
		this.#subscribe();
		if (!this.#access) return [];
		return Array.from(this.#access.inputs.values());
	}

	onNote(callback: MidiNoteCallback): () => void {
		this.#callbacks.add(callback);
		return () => this.#callbacks.delete(callback);
	}
}
```

**Answer convergence—every surface calls `state.guess(pc)`:**

| Surface                 | Conversion before calling `guess`                             |
| ----------------------- | ------------------------------------------------------------- |
| Piano keyboard          | `pc` from button's data attribute—no conversion               |
| Guitar / bass fretboard | `fretToMidiNote(tuning[string], fret) % 12`                   |
| Letter buttons          | `pc` from button's data attribute—no conversion               |
| Fixed-do solfege        | `pc` from button's data attribute (Do=0 always)—no conversion |
| Keyboard shortcuts      | `KEYBOARD_SHORTCUT_MAP[event.key]`                            |
| MIDI                    | `noteNumber % 12` from `onNote` callback                      |

**`PersistedSettings` backward-compat extension:**

```ts
export type PersistedSettings = {
	keyId: string;
	eligibleNotes: number[];
	octaveLo: number;
	octaveHi: number;
	answerSurface?: AnswerSurfaceId; // optional; absent in pre-M10 stored data
};
```

`isPersistedSettings` accepts payloads where `answerSurface` is absent (defaults to `'piano'`) and rejects payloads where `answerSurface` is present but not a member of `AnswerSurfaceId`. The existing four required fields are unchanged.

**SSR safety invariants:**

- `MidiInput` guards all `navigator` access behind `browser` from `$app/environment`. The class can be constructed on the server without throwing.
- No MIDI or Web Audio API is referenced at module scope outside of `browser` guards or `createSubscriber`/`onMount` callbacks.
- `<svelte:window onkeydown={handleShortcut}>` in `+page.svelte` handles global shortcuts—no `onMount`, no module-scope `addEventListener`.
- `$effect` is used in exactly two places in this milestone: (1) focus management after auto-advance; (2) never for event subscription (that belongs to `createSubscriber`).

**Dynamic surface selection (no `<svelte:component>`):**

```svelte
<script lang="ts">
	import { type Component } from 'svelte';
	// ...surface imports...
	const SURFACES = {
		piano: PianoKeyboard,
		'guitar-fretboard': GuitarFretboard,
		'bass-fretboard': BassFretboard,
		'letter-buttons': LetterButtons,
		'fixed-do-solfege': FixedDoSolfege,
		'keyboard-shortcuts': LetterButtons, // same UI, shortcuts wire via svelte:window
		midi: MidiSurface
	} satisfies Record<AnswerSurfaceId, Component>;

	const SurfaceComponent = $derived(SURFACES[state.answerSurface]);
</script>

<SurfaceComponent />
```

**Keyboard shortcut handler guard (input focus safety):**

```ts
function handleShortcut(event: KeyboardEvent) {
	const target = event.target as Element;
	if (
		target instanceof HTMLInputElement ||
		target instanceof HTMLSelectElement ||
		target instanceof HTMLTextAreaElement
	)
		return;
	if (event.key === '?') {
		openShortcutHelp();
		return;
	}
	if (state.phase !== 'guessing') return;
	const pc = KEYBOARD_SHORTCUT_MAP[event.key.toLowerCase()];
	if (pc !== undefined) {
		event.preventDefault();
		state.guess(pc);
	}
}
```

## Dependencies

- **Milestone 09 (Public AP Beta and Proof Loop):** consumes the established AP drill loop, `createPracticeState()` factory, `guess(pc)` seam, `AttemptEvent` v1 log (bumped to v2 here), and the `learning/drills` module structure introduced in milestone 00 and matured through 09.

## External Dependency Contracts

Every dependency below must have a local stub that satisfies its TypeScript contract. Tests import the stub; the stub is replaced by the real upstream import when the issue ships—without requiring test changes.

| Capability                                          | Owner                                                             | Contract                                                                                                        | Local stub                                                                                                                                                                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pitch-class → fixed-do solfege name                 | [Octavian #18](https://github.com/stevekinney/octavian/issues/18) | `toFixedDoSolfege(pc: PitchClass): string`                                                                      | Implement in `src/lib/learning/drills/answer-surface.ts` as `const FIXED_DO_NAMES = ['Do','Di','Re','Ri','Mi','Fa','Fi','Sol','Si','La','Li','Ti']`; `toFixedDoSolfege = (pc) => FIXED_DO_NAMES[pc % 12]`                                    |
| Fretboard position → MIDI note number               | [Octavian #19](https://github.com/stevekinney/octavian/issues/19) | `fretToMidiNote(openMidi: number, fret: number): number`                                                        | Implement in `src/lib/learning/drills/answer-surface.ts` as `openMidi + fret` (pure integer arithmetic, no dependency)                                                                                                                       |
| Instrument metadata (string count, standard tuning) | [Octavian #20](https://github.com/stevekinney/octavian/issues/20) | `GuitarInstrument` and `BassInstrument` types with `tuning: number[]`                                           | Use `GUITAR_STANDARD_TUNING` and `BASS_STANDARD_TUNING` constants defined locally in `answer-surface.ts`                                                                                                                                     |
| MIDI message parsing and pitch-class conversion     | [Octavian #31](https://github.com/stevekinney/octavian/issues/31) | `parseMidiMessage(data: Uint8Array): { type: 'note-on' \| 'note-off', note: number, velocity: number } \| null` | Implement inline in `src/lib/midi.svelte.ts`: status byte `data[0] & 0xF0 === 0x90` = note-on; `note = data[1]`; `velocity = data[2]`; velocity 0 treated as note-off; returns `null` for non-note messages or messages shorter than 3 bytes |
| Pitch-class enharmonic answer comparison            | [Octavian #35](https://github.com/stevekinney/octavian/issues/35) | `pitchClassEquals(a: PitchClass, b: PitchClass): boolean`                                                       | Already stubbed in `src/lib/learning/drills/schema.ts` as `a % 12 === b % 12` (milestone 00 deliverable); no new stub needed                                                                                                                 |
| Piano keyboard layout helpers                       | [Octavian #36](https://github.com/stevekinney/octavian/issues/36) | White/black key layout data for piano surface rendering                                                         | Already implemented locally in `src/lib/music.ts` and `piano-keyboard.svelte`; no new stub needed                                                                                                                                            |
| Choice grid component (12-button layout)            | [Cinder #318](https://github.com/stevekinney/cinder/issues/318)   | `<ChoiceGrid>` with `selected`, `disabled`, `correct`, `incorrect` states                                       | Build local `src/lib/components/answer-surfaces/choice-grid.svelte` as `<div role="group">` + `<button>` CSS grid; replace with Cinder component when #318 ships                                                                             |
| Capability gate component (MIDI unsupported)        | [Cinder #321](https://github.com/stevekinney/cinder/issues/321)   | `<CapabilityGate supported={bool}>` renders children or fallback slot                                           | Implement as a local `{#if midi.available}…{:else}…{/if}` block inside `midi-surface.svelte`; replace when #321 ships                                                                                                                        |
| Shortcut discovery chip component                   | [Cinder #323](https://github.com/stevekinney/cinder/issues/323)   | `<ShortcutChip key="A" label="C" />` visual chip                                                                | Render plain `<kbd>` elements inside the `<dialog>` `<dl>`; replace with `<ShortcutChip>` when #323 ships                                                                                                                                    |

## Acceptance Criteria

Each criterion is a concrete pass/fail check with a named verifying test.

1. **Guitar fretboard answers.** A learner can tap any pitch class on a 6-string standard-tuning fretboard (frets 0–12) and the drill engine receives a valid answer event with the correct pitch class. Tapping fret 0 on string 1 (high E) produces pitch class 4. Enharmonic normalization applies: a fret that maps to C♯ and a fret that maps to D♭ both resolve to pitch class 1. Fret range and tuning are constants at this milestone (no user configuration). Verified by `guitar-fretboard: fret tap on string 1 fret 0 emits pitch class 4` and `answer-surface-guitar-fretboard [1280×800]` Playwright spec.

2. **Bass fretboard answers.** Same contract as guitar for a 4-string EADG fretboard. Alternate tunings and 5-string bass are not available at this milestone. Verified by `bass-fretboard: renders 4 strings × 13 frets` and `bass-fretboard: fret tap maps to correct pitch class`.

3. **Letter buttons.** A learner can answer using 12 pitch-class letter buttons (C through B with enharmonic labels matching the active key spelling). The surface is always chromatic and key-independent. Verified by `letter-buttons: renders 12 buttons covering all pitch classes` and `answer-surface-letter-buttons [1280×800]` Playwright spec.

4. **Fixed-do solfege buttons.** A learner can answer using Do/Di/Re/Ri/Mi/Fa/Fi/Sol/Si/La/Li/Ti buttons. Do always maps to pitch class 0 (C), Re to 2, Mi to 4—no tonic context required or used. Verified by `fixed-do-solfege: clicking Do emits pitch class 0` and `fixed-do-solfege: all 12 syllables map to distinct pitch classes`.

5. **Keyboard shortcuts.** A learner can trigger any pitch-class answer using the defined 12-key scheme (`a`→C, `w`→C♯, `s`→D, `e`→D♯, `d`→E, `f`→F, `t`→F♯, `g`→G, `y`→G♯, `h`→A, `u`→A♯, `j`→B) without focusing any button first. All 12 pitch classes are reachable; no two keys share a pitch class. Shortcut does not fire when focus is inside an input, select, or textarea. Verified by `keyboard-shortcuts: KEYBOARD_SHORTCUT_MAP covers all 12 pitch classes exactly once`, `keyboard-shortcuts: no two keys share a pitch class`, and `answer-surface-keyboard-shortcuts [1280×800]` Playwright spec.

6. **Shortcut discovery.** Pressing `?` during the guessing phase opens a modal dialog listing all 12 shortcuts. The dialog is also reachable via an explicit button in the surface panel. Escape closes it and returns focus to the triggering element. Verified by `answer-surface-keyboard-shortcut-help [1280×800]` Playwright spec and `shortcut-help-dialog: lists all 12 pitch-class shortcuts`.

7. **MIDI single-note input (Chrome / Edge).** A MIDI keyboard `note-on` event with velocity > 0 is received, parsed to a pitch class via `noteNumber % 12`, and submitted as a drill answer. `note-off` messages (velocity 0 or status `0x80`) do not produce an answer event. Verified by unit tests `midi: note-on message with velocity > 0 maps to correct pitch class` and `midi: note-off does not emit an answer`, and by the `answer-surface-midi-injection [1280×800]` Playwright spec using a `page.evaluate`-injected fake `MIDIAccess`.

8. **MIDI graceful fallback.** When `'requestMIDIAccess' in navigator` is false, the MIDI option in the surface selector is disabled with `aria-disabled="true"` and a visible explanation in a `role="status"` region. No broken controls appear. All other surfaces remain functional. If a previously saved preference of `'midi'` is loaded in an unsupported browser, the app falls back to `'piano'` and shows a one-time notice. Verified by `answer-surface-midi-unsupported [1280×800]` Playwright spec (with `page.evaluate` removing `navigator.requestMIDIAccess`) and `midi-surface: renders fallback when midiAvailable is false` component test.

9. **Answer equivalence across surfaces.** For a given target pitch class, answering via piano, guitar fretboard, bass fretboard, letter buttons, fixed-do solfege, keyboard shortcut, and MIDI all produce identical scoring outcomes. Verified by parameterized unit test `answer-equivalence: all seven surfaces produce correct score for matching pitch class`.

10. **Attempt-event schema v2.** Every drill attempt event contains `answerSurface: AnswerSurfaceId`, `answerSource: 'pointer' | 'keyboard' | 'midi'`, and `midiAvailable: boolean`. Events never contain MIDI device identifiers (name, manufacturer, id). Verified by `attempt-event-v2: piano attempt event contains all v2 fields` and `attempt-event-v2: midi attempt event contains no device-identifier field`.

11. **v1 event backward compatibility.** `loadAttemptLog()` reads both `vibratone:attempts:v1` and `vibratone:attempts:v2`; v1 events are re-typed with `answerSurface: 'piano'`, `answerSource: 'pointer'`, `midiAvailable: false` without writing to storage. Verified by `attempt-log: v1 events load with default v2 fields`.

12. **Surface switch without data loss.** Switching answer surfaces mid-session does not reset session score, streak, or FSRS card state. The new surface renders in the current phase with no answer pre-filled. Verified by `surface-switcher: switching surface does not reset score or round` unit test and `answer-surface-switch-mid-session [1280×800]` Playwright spec.

13. **Settings persistence.** The learner's chosen answer surface is written to `localStorage` under `vibratone:settings` (as `answerSurface`) and restored on page load. A payload without the `answerSurface` field passes `isPersistedSettings` and defaults to `'piano'`. Verified by `persistence: isPersistedSettings accepts legacy payload without answerSurface field` and `answer-surface-persist [1280×800]` Playwright spec.

14. **Keyboard-only navigation.** A keyboard-only operator can complete a full AP drill round (prompt plays → answer surface buttons are Tab/Arrow-reachable → Enter or Space submits → feedback is announced → next round) with no mouse events. Verified by `a11y-keyboard-only [1280×800]` Playwright spec.

15. **Screen-reader flow.** The `aria-live="polite"` region (already present in `practice-card.svelte`) announces: (a) when a new prompt plays, (b) the label of the submitted answer, (c) whether the answer was correct or incorrect, (d) the updated score. No silent focus traps exist. Verified by `a11y-aria-live-regions [1280×800]` Playwright spec using `getByRole`.

16. **axe-core scan.** An automated axe-core scan of the drill page with each of the seven answer surfaces active produces zero critical or serious violations. Verified by seven parameterized `a11y-axe-scan` Playwright tests (one per surface).

17. **Responsive phone layout.** At 390×844 viewport, all answer surfaces display without horizontal overflow on the page. All tappable elements have computed `offsetHeight` and `offsetWidth` ≥ 44 px. Play, replay, and submit controls are visible without scrolling. Verified by `responsive-390-overflow` and `responsive-390-touch-targets` Playwright specs.

## Test Plan

### Unit tests (`src/lib/learning/drills/` and `src/lib/`)

**`src/lib/learning/drills/answer-surface.spec.ts`**

- `answer-surface: KEYBOARD_SHORTCUT_MAP covers all 12 pitch classes exactly once`
- `answer-surface: KEYBOARD_SHORTCUT_MAP has no duplicate key entries`
- `answer-surface: KEYBOARD_SHORTCUT_MAP lookup is case-insensitive (A and a return same pc)`
- `answer-surface: KEYBOARD_SHORTCUT_MAP lookup for unbound key returns undefined`
- `answer-surface: fretToMidiNote(openMidi=40, fret=0) returns 40`
- `answer-surface: fretToMidiNote(openMidi=40, fret=12) returns 52`
- `answer-surface: GUITAR_STANDARD_TUNING has 6 strings with open notes E2 A2 D3 G3 B3 E4 (MIDI 40 45 50 55 59 64)`
- `answer-surface: BASS_STANDARD_TUNING has 4 strings with open notes E1 A1 D2 G2 (MIDI 28 33 38 43)`
- `answer-surface: toFixedDoSolfege(0) returns Do`
- `answer-surface: toFixedDoSolfege(2) returns Re`
- `answer-surface: toFixedDoSolfege(4) returns Mi`
- `answer-surface: toFixedDoSolfege(11) returns Ti`
- `answer-surface: AP_ALLOWED_SURFACES does not include movable-do-solfege or scale-degree`
- `answer-surface: AP_ALLOWED_SURFACES includes all seven AP-legal surfaces`

**`src/lib/learning/drills/midi.spec.ts`**

- `midi: parseMidiMessage returns note-on for status 0x90 note=60 velocity=64`
- `midi: parseMidiMessage returns note-off for status 0x80`
- `midi: parseMidiMessage treats note-on with velocity=0 as note-off`
- `midi: parseMidiMessage returns null for control-change message (status 0xB0)`
- `midi: parseMidiMessage returns null for messages shorter than 3 bytes`
- `midi: note number 60 maps to pitch class 0 (C)`
- `midi: note number 61 maps to pitch class 1 (C♯)`
- `midi: note number 71 maps to pitch class 11 (B)`
- `midi: note number 72 maps to pitch class 0 (C, wraps)`
- `midi: note-on via injected fake MIDIAccess fires onNote callback with correct note and velocity`
- `midi: note-off via injected fake MIDIAccess does not fire onNote callback`
- `midi: requestMIDIAccess rejection does not throw (permission denied path)`
- `midi: MidiInput.available is false when navigator.requestMIDIAccess is absent`
- `midi: onNote teardown removes the callback (no double-fire after unsubscribe)`
- `midi: attempt event emitted from MIDI note-on contains no device-identifier field`

**`src/lib/learning/drills/answer-equivalence.spec.ts`** (parameterized)

- `answer-equivalence: piano surface submitting pc 4 for target pc 4 scores correct`
- `answer-equivalence: guitar-fretboard surface submitting pc 4 for target pc 4 scores correct`
- `answer-equivalence: bass-fretboard surface submitting pc 4 for target pc 4 scores correct`
- `answer-equivalence: letter-buttons surface submitting pc 4 for target pc 4 scores correct`
- `answer-equivalence: fixed-do-solfege surface submitting pc 4 for target pc 4 scores correct`
- `answer-equivalence: keyboard-shortcuts surface submitting pc 4 for target pc 4 scores correct`
- `answer-equivalence: midi surface submitting pc 4 for target pc 4 scores correct`
- `answer-equivalence: all seven surfaces submitting wrong pc for target pc 4 score incorrect (table-driven)`
- `answer-equivalence: octave-independence — MIDI note 52 (E3) and note 64 (E4) both resolve to pc 4`

**`src/lib/learning/drills/attempt-event-v2.spec.ts`**

- `attempt-event-v2: AttemptEvent.version is the literal 2`
- `attempt-event-v2: piano attempt event contains answerSurface, answerSource, midiAvailable fields`
- `attempt-event-v2: guitar-fretboard attempt event answerSurface is guitar-fretboard`
- `attempt-event-v2: keyboard shortcut answer has answerSource pointer (not keyboard — shortcut fires the existing guess seam)`

  > Note: `answerSource` is `'keyboard'` when the key shortcut is the direct input modality. The shortcut handler calls `state.guess(pc)` which sets `answerSource: 'keyboard'`.

- `attempt-event-v2: midi attempt event has answerSurface midi and answerSource midi`
- `attempt-event-v2: midi attempt event contains no midiDeviceIdentifier field (privacy negative — asserts field absence)`
- `attempt-event-v2: midiAvailable: true when MidiInput.available is true`
- `attempt-event-v2: midiAvailable: false when navigator.requestMIDIAccess is absent`
- `attempt-event-v2: switching surface mid-session updates answerSurface on subsequent events, not past events`

**`src/lib/learning/drills/attempt-log-v2.spec.ts`**

- `attempt-log: loadAttemptLog reads vibratone:attempts:v2 key`
- `attempt-log: loadAttemptLog reads vibratone:attempts:v1 key and re-types with default v2 fields`
- `attempt-log: v1 events have answerSurface: piano answerSource: pointer midiAvailable: false after re-type`
- `attempt-log: appendAttemptEvent writes to vibratone:attempts:v2 (not v1)`
- `attempt-log: v1 entries appear before v2 entries in loadAttemptLog output`
- `attempt-log: malformed v1 value returns empty array without throwing`

**`src/lib/persistence.spec.ts`** (additions to existing file)

- `persistence: isPersistedSettings accepts legacy payload without answerSurface field`
- `persistence: isPersistedSettings rejects payload with invalid answerSurface value (e.g., "trumpet")`
- `persistence: isPersistedSettings accepts payload with valid answerSurface value (e.g., "guitar-fretboard")`
- `persistence: loadJSON falls back to DEFAULT_SETTINGS (answerSurface: piano) for old-shape payload`

### Component tests (`src/lib/components/`, vitest-browser-svelte)

**`src/lib/components/answer-surfaces/guitar-fretboard.svelte.test.ts`**

- `guitar-fretboard: renders 6 string rows and 13 fret columns (78 buttons)`
- `guitar-fretboard: each button has aria-label including string number, fret number, and pitch name`
- `guitar-fretboard: fret tap on string 1 fret 0 calls state.guess with pc 4 (E)`
- `guitar-fretboard: fret tap on string 6 fret 0 calls state.guess with pc 4 (E, low E same pc as high E)`
- `guitar-fretboard: fret 12 on any string has same pitch class as fret 0 on that string`
- `guitar-fretboard: correct-answer fret shows aria-pressed=true after reveal`
- `guitar-fretboard: wrong-answer fret shows aria-invalid after reveal`
- `guitar-fretboard: all fret buttons are disabled when phase is not guessing`
- `guitar-fretboard: Tab exits the fretboard group (no focus trap)`

**`src/lib/components/answer-surfaces/letter-buttons.svelte.test.ts`**

- `letter-buttons: renders 12 buttons covering all pitch classes`
- `letter-buttons: button click calls state.guess with correct PitchClass`
- `letter-buttons: buttons are disabled when phase is not guessing`
- `letter-buttons: correct button shows aria-pressed=true after reveal`
- `letter-buttons: wrong button shows aria-invalid after reveal`
- `letter-buttons: keyboard shortcut label is visible on each button`
- `letter-buttons: aria-label uses full spoken name (C sharp, not C#)`

**`src/lib/components/answer-surfaces/fixed-do-solfege.svelte.test.ts`**

- `fixed-do-solfege: renders 12 solfege buttons (Do Di Re Ri Mi Fa Fi Sol Si La Li Ti)`
- `fixed-do-solfege: clicking Do calls state.guess with pc 0`
- `fixed-do-solfege: clicking Mi calls state.guess with pc 4`
- `fixed-do-solfege: all 12 syllables present and map to distinct pitch classes`
- `fixed-do-solfege: buttons are disabled when phase is not guessing`

**`src/lib/components/answer-surfaces/midi-surface.svelte.test.ts`**

- `midi-surface: renders connect button when midiAvailable is true`
- `midi-surface: renders fallback message containing "not supported in this browser" when midiAvailable is false`
- `midi-surface: fallback message is in a role=status region`
- `midi-surface: no broken controls appear when midiAvailable is false`
- `midi-surface: calls state.guess with correct pc when onNote fires`

**`src/lib/components/surface-switcher.svelte.test.ts`**

- `surface-switcher: renders only AP_ALLOWED_SURFACES options`
- `surface-switcher: does not render movable-do-solfege or scale-degree options`
- `surface-switcher: selecting guitar-fretboard calls state.setAnswerSurface with guitar-fretboard`
- `surface-switcher: selected surface option has checked state`
- `surface-switcher: keyboard navigation: Arrow keys move between options, Enter selects`

**`src/lib/components/shortcut-help-dialog.svelte.test.ts`**

- `shortcut-help-dialog: renders a trigger button`
- `shortcut-help-dialog: opens dialog when trigger button is activated`
- `shortcut-help-dialog: dialog contains entry for each of 12 pitch classes`
- `shortcut-help-dialog: Escape closes dialog and returns focus to trigger`
- `shortcut-help-dialog: shortcut list is readable via getByRole (not hidden in aria-hidden)`

### Playwright E2E tests (`e2e/`, `.e2e.ts` suffix)

**`e2e/answer-surfaces.e2e.ts`**

- `answer-surface-piano [1280×800]: existing piano keyboard flow works unchanged after surface refactor`
- `answer-surface-guitar-fretboard [1280×800]: select guitar-fretboard → play note → tap correct fret → score increments`
- `answer-surface-guitar-fretboard [390×844]: fretboard renders without horizontal page overflow`
- `answer-surface-letter-buttons [1280×800]: select letter-buttons → play note → click correct letter → score increments`
- `answer-surface-letter-buttons [390×844]: letter-buttons render without horizontal page overflow`
- `answer-surface-fixed-do-solfege [1280×800]: select fixed-do-solfege → play note → click Do → score increments`
- `answer-surface-keyboard-shortcuts [1280×800]: select keyboard-shortcuts → play note → press correct letter key → score increments`
- `answer-surface-keyboard-shortcut-help [1280×800]: press ? during guessing phase → dialog opens with full shortcut map → Escape closes`
- `answer-surface-persist [1280×800]: select guitar-fretboard → reload page → guitar-fretboard is pre-selected`
- `answer-surface-switch-mid-session [1280×800]: switch from piano to letter-buttons mid-session → score and round counter unchanged`
- `answer-surface-midi-injection [1280×800]: page.evaluate injects fake MIDIAccess → synthetic note-on event submits answer and reveals result`
- `answer-surface-midi-unsupported [1280×800]: page.evaluate removes navigator.requestMIDIAccess → MIDI option is disabled with visible fallback message`
- `answer-surface-midi-permission-denied [1280×800]: page.evaluate rejects requestMIDIAccess promise → fallback message appears, piano surface still works`

**`e2e/accessibility.e2e.ts`** (parameterized across mobile 390×844, tablet 768×1024, desktop 1280×800)

- `a11y-keyboard-only [1280×800]: Tab reaches Play → Enter plays note → Tab enters surface group → Arrow moves between options → Enter selects → Tab reaches answer buttons → Enter submits → Tab reaches Next (or auto-advance fires)`
- `a11y-keyboard-only [1280×800]: no mouse events in any interaction (page.mouse is never called)`
- `a11y-aria-live-regions [1280×800]: aria-live region announces correct/incorrect after letter-buttons guess`
- `a11y-aria-live-regions [1280×800]: aria-live region announces correct/incorrect after guitar-fretboard guess`
- `a11y-axe-scan [1280×800]: zero critical violations on drill page with piano surface`
- `a11y-axe-scan [1280×800]: zero critical violations on drill page with guitar-fretboard surface`
- `a11y-axe-scan [1280×800]: zero critical violations on drill page with letter-buttons surface`
- `a11y-axe-scan [1280×800]: zero critical violations on drill page with fixed-do-solfege surface`
- `a11y-axe-scan [1280×800]: zero critical violations on drill page with keyboard-shortcuts surface`
- `a11y-axe-scan [1280×800]: zero critical violations on drill page with midi surface (midiAvailable: false state)`
- `a11y-focus-after-auto-advance [1280×800]: after auto-advance, focus moves to play/replay button`
- `a11y-shortcut-no-fire-in-input [1280×800]: pressing A in a focused text input does not submit a guess`
- `responsive-390-overflow [390×844]: all answer surfaces display without horizontal overflow`
- `responsive-390-touch-targets [390×844]: all answer surface buttons have offsetWidth and offsetHeight >= 44`
- `responsive-768-no-overflow [768×1024]: fretboard and piano are visible without horizontal page scrolling`

## Verification

Run these gate commands in order. All must exit clean before the milestone is declared complete:

```sh
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

**Grep gate (AP-claims guard):**

```sh
grep -rE "perfect pitch|guaranteed|will learn" src/
```

Must return no matches.

**Grep gate (no `<svelte:component>`):**

```sh
grep -r "svelte:component" src/
```

Must return no matches (Svelte 5 dynamic components use direct variable references).

**Manual browser smokes:**

- Chrome desktop with a hardware MIDI keyboard (or virtual MIDI port): connect the device, play a note, confirm the drill answer registers and `localStorage['vibratone:attempts:v2']` contains an event with `answerSurface: 'midi'` and no device-identifier field.
- Firefox: confirm MIDI option shows the fallback message and piano surface continues to work.
- Safari on macOS VoiceOver: run the keyboard-only path; confirm all live-region announcements are spoken; confirm focus returns to the play button after auto-advance.

## Non-Goals

- Do not require MIDI for any core AP flow.
- Do not build movable-do solfege or scale-degree number answer surfaces—both require tonic context, train relative-pitch recognition, and belong to the Relative Pitch track (a later milestone).
- Do not build chord or scale-degree MIDI capture. Single-note MIDI only at this milestone.
- Do not build staff notation answer surfaces.
- Do not build alternate instrument tunings (Drop D, DADGAD, 5-string bass).
- Do not build native mobile apps.
- Do not introduce auth, a database, or server-side state.
- Do not store MIDI device identifiers (name, manufacturer, id) in any storage or event.
- Do not use axe-core scan results as a substitute for manual keyboard-only and screen-reader verification. Automated scans are a floor, not a ceiling.

## Completion Signal

This milestone is complete when:

1. `bun run check`, `bun run lint`, and `bun run test:unit -- --run` all exit clean with zero new failures.
2. All named unit tests in the Test Plan pass, including the `answer-equivalence` parameterized suite covering all seven surfaces.
3. All named component tests (`*.svelte.test.ts`) pass.
4. All named Playwright e2e tests in `e2e/answer-surfaces.e2e.ts` and `e2e/accessibility.e2e.ts` pass at phone (390×844), tablet (768×1024), and desktop (1280×800) viewports.
5. The axe-core scans produce zero critical or serious violations on the drill page for every answer surface.
6. A keyboard-only Playwright test completes a full AP drill round with no mouse events.
7. `localStorage['vibratone:attempts:v2']` entries contain all v2 fields including `answerSurface`, `answerSource`, and `midiAvailable`; no entry contains a MIDI device identifier.
8. The grep gate returns no matches for AP-efficacy phrases, and no `<svelte:component>` usage.
9. All pre-existing tests (`round.spec.ts`, `scoring.spec.ts`, `music.spec.ts`, `persistence.spec.ts`, `audio.spec.ts`, and all existing `.svelte.test.ts` files) remain green with no modifications.
