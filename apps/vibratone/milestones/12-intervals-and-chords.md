# 12. Intervals and Chords as Supporting Skills

## Outcome

A learner can practice interval identification (ascending, descending, harmonic, and in-key), interval construction, chord identification for triads and seventh chords, and chord-tone recognition—and receive mistake feedback that names the specific error, semitone distance, and scale or chord context—without any of these drills being required steps in the AP or Relative Pitch progression.

## Product Requirements

- Add interval identification: ascending, descending, harmonic, and in-key diatonic context (key selected from the `KEYS` list in `src/lib/music.ts`).
- Add interval construction using two sequential single-note selections on the existing M10 answer surface (root first, then the target note). No new answer-surface infrastructure beyond what M10 delivered.
- Add interval singing **only if** `docs/spikes/microphone-feasibility.md` (produced by Milestone 03) records a GO decision. See the GO/NO-GO branch resolution below.
- Add chord identification for triads (major, minor, diminished, augmented) and seventh chords (dominant 7, major 7, minor 7, half-diminished 7, fully-diminished 7).
- Add blocked chord playback (all notes simultaneously) and arpeggiated chord playback (notes in ascending order via `AudioContext.currentTime` offsets; never `setTimeout`). Both share a toggle UI before answering.
- Add chord-tone recognition: root, third, fifth, seventh, and bass.
- Add explain-my-mistake feedback containing: semitone distance error for intervals, scale context when diatonic degree is set, chord role text for chord-tone errors, and an optional reference-song mnemonic (static lookup, ≤13 entries covering minor 2nd through octave).
- Add confusion-pair sub-mode for both intervals and chords, as a toggle within the existing interval and chord practice routes—no separate routes.

### Interval Singing: GO/NO-GO Branch Resolution

The decision source is `docs/spikes/microphone-feasibility.md`, committed during Milestone 03.

**If GO is recorded:** Interval singing ships as part of this milestone. It uses `getUserMedia` → `AnalyserNode` → `pitchy` (already integrated in M03's `src/lib/audio/microphone.ts`). The hard privacy invariant from Milestone 03 applies without exception: only derived `{detectedNote, centsOffset, clarityScore, uncertain}` fields may enter attempt events. Raw `AudioBuffer` samples, `Float32Array` analyser data, and `MediaStream` tracks must never be stored in `localStorage`, `sessionStorage`, `IndexedDB`, or any network surface. The mic stream must stop when the interval singing drill exits (via `onDestroy` / route navigation), assertable by a `MediaStreamTrack.readyState` spy. Attempt events for singing include an `inputMode: 'singing'` field on the `IntervalAttemptEvent`.

**If NO-GO is recorded:** Interval singing is removed from this milestone's scope entirely. A follow-up milestone is opened (via `gh issue create`) scoped to re-evaluating mic feasibility after the specific failing threshold is resolved. All other M12 scope—identification, construction, chord drills, feedback, analytics—ships regardless of the mic outcome.

A junior determines which branch applies by reading the GO/NO-GO conclusion line in `docs/spikes/microphone-feasibility.md`. No further product judgment is required.

## User Experience Requirements

- Interval and chord drills are accessible from a dedicated Supporting Skills navigation entry. They do not appear in the AP track's primary navigation or recommendation queue unless the learner explicitly navigates there.
- Learners can select interval direction (ascending, descending, harmonic) before each session begins.
- Chord prompts display a blocked/arpeggiated toggle that persists across drills within the session.
- The explain-my-mistake panel appears after an incorrect guess and disappears when advancing to the next prompt. It is triggered automatically—no extra button press required to see it.
- In confusion-pair sub-mode, a "Practice confusions" toggle in the session setup draws from the learner's personal confusion history. When history is empty, the sub-mode presents a default starter pair (minor 3rd vs. major 3rd for intervals; major vs. minor triad for chords).
- The app remains usable on phone (375×667), tablet (768×1024), and desktop (1280×800) at every step of both drill flows.

## Data and Analytics Requirements

Interval and chord attempts extend the existing `AttemptEvent` discriminated union in `src/lib/learning/drills/schema.ts`. The union is keyed on `drillType`. Existing note-drill events (which lack a `drillType` field in the raw log) are treated as `drillType: 'note'` on read—`loadAttemptLog` must normalize them rather than discard them, so Milestone 02's FSRS scheduling retains its full AP history.

**`AttemptEventBase`** (shared fields on every event type):

```ts
export type AttemptEventBase = {
	version: 2;
	drillId: string;
	promptId: string;
	sessionId: string;
	timestamp: number;
	responseTimeMs: number;
	timbre: string;
	stimulusType:
		| 'synthesized'
		| 'sampled'
		| 'sequence'
		| 'harmonic-interval'
		| 'melodic-interval'
		| 'chord-blocked'
		| 'chord-arpeggiated';
	referenceAvailable: boolean;
	answerSurface: string;
};
```

**`IntervalAttemptEvent`**:

```ts
export type IntervalAttemptEvent = AttemptEventBase & {
	drillType: 'interval';
	direction: 'ascending' | 'descending' | 'harmonic';
	semitoneDistance: number;
	diatonicDegree: number | null; // null in context-free (chromatic) mode
	contextKey: string | null; // KeyDefinition.id; null for context-free
	answer: number; // semitone distance guessed
	correctAnswer: number;
	correct: boolean;
	explanationShown: boolean;
	inputMode: 'surface' | 'singing'; // 'singing' only when mic GO branch is active
};
```

**`ChordAttemptEvent`**:

```ts
export type ChordAttemptEvent = AttemptEventBase & {
	drillType: 'chord';
	quality: ChordQuality;
	inversion: 0 | 1 | 2 | 3;
	voicing: 'close' | 'open';
	playbackStyle: 'blocked' | 'arpeggiated';
	answer: ChordQuality;
	correctAnswer: ChordQuality;
	correct: boolean;
	explanationShown: boolean;
};
```

**`ChordToneAttemptEvent`**:

```ts
export type ChordToneAttemptEvent = AttemptEventBase & {
	drillType: 'chord-tone';
	quality: ChordQuality;
	inversion: 0 | 1 | 2 | 3;
	targetChordTone: ChordToneLabel;
	answer: ChordToneLabel;
	correctAnswer: ChordToneLabel;
	correct: boolean;
	explanationShown: boolean;
};
```

**Supporting types** (added to `schema.ts`):

```ts
export type ChordQuality =
	'maj' | 'min' | 'dim' | 'aug' | 'dom7' | 'maj7' | 'min7' | 'half-dim7' | 'dim7';

export type ChordToneLabel = 'root' | 'third' | 'fifth' | 'seventh' | 'bass';

export type AttemptEvent =
	| NoteAttemptEvent // existing, normalized from v1 records on read
	| IntervalAttemptEvent
	| ChordAttemptEvent
	| ChordToneAttemptEvent;
```

**`loadAttemptLog` migration guard:** v1 records (those lacking a `drillType` field) are read as `NoteAttemptEvent` with `drillType: 'note'` and `version: 2` applied in memory. They are not re-written to `localStorage`—migration is lazy and lossless.

**Analytics requirements:**

- `getIntervalConfusionPairs()` returns only events where `drillType === 'interval'`.
- `getChordConfusionPairs()` returns only events where `drillType === 'chord'`.
- `getApConfusionPairs()` returns only events where `drillType === 'note'`—zero interval or chord events leak into it.
- `responseTimeMs` for interval prompts is measured from the moment the drill phase transitions to `'guessing'`. For arpeggiated prompts it is measured from when the last note onset fires (`AudioContext.currentTime` offset to `performance.now()` equivalent), not when the sequence begins.
- `explanationShown` defaults to `false` on event construction and is set to `true` if the explain-my-mistake panel is visible when the learner advances.

## Accessibility Requirements

- Interval answer buttons expose `aria-pressed` state; correct/incorrect reveal states are communicated via a `role="status"` region—not through color alone.
- Chord quality buttons expose `aria-pressed` state; the inversion selector is implemented as a `<fieldset>` + `<legend>` with radio buttons.
- The blocked/arpeggiated playback toggle exposes current state via `aria-pressed` on each button, wrapped in `<div role="group" aria-label="Chord playback style">`. An `aria-live="polite"` region announces the current style when it changes, suppressed when `prefers-reduced-motion: reduce` is active.
- The explain-my-mistake panel renders in a `role="status"` container. Primary explanation text is always present. The reference-song mnemonic (when available) is inside a `<details>` element—collapsed by default, expandable by keyboard—so screen readers receive the primary text unconditionally.
- A learner can complete one interval identification drill using keyboard only: Tab to the answer surface, Tab/arrow keys to navigate options, Enter to confirm, read feedback from the `role="status"` region.
- Responsive smoke at 375×667, 768×1024, and 1280×800 confirms all interactive controls are visible and reachable.

## Module and Architecture Targets

### New and modified files

| File                                                | Action     | What lands there                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/learning/drills/schema.ts`                 | **Modify** | Add `IntervalAttemptEvent`, `ChordAttemptEvent`, `ChordToneAttemptEvent`, `ChordQuality`, `ChordToneLabel`, `IntervalPrompt`, `ChordPrompt`; extend `AttemptEvent` discriminated union; update `loadAttemptLog` migration guard                                                                                                                                                                                      |
| `src/lib/learning/drills/attempt-log.ts`            | **Modify** | `loadAttemptLog` normalizes v1 records to `drillType: 'note'` on read; `appendAttemptEvent` unchanged                                                                                                                                                                                                                                                                                                                |
| `src/lib/learning/drills/interval-stub.ts`          | **Create** | `intervalBetween(a: Pitch, b: Pitch): { semitones: number; diatonicDegree: number \| null }`; `buildIntervalPool(config: IntervalDrillConfig): IntervalPrompt[]`; `scoreIntervalAnswer(answer: number, correct: number): boolean`; `validateIntervalConstruction(root: Pitch, selected: Pitch, target: number): boolean`                                                                                             |
| `src/lib/learning/drills/chord-stub.ts`             | **Create** | `CHORD_INTERVALS: Record<ChordQuality, number[]>`; `buildChord(root: PitchClass, quality: ChordQuality, inversion: number): PitchClass[]`; `chordToFrequencies(chord: PitchClass[], octave: number): number[]`; `scoreChordAnswer(answer: ChordQuality, correct: ChordQuality): boolean`; `scoreChordToneAnswer(answer: ChordToneLabel, correct: ChordToneLabel): boolean`                                           |
| `src/lib/learning/drills/interval-mnemonics.ts`     | **Create** | `INTERVAL_MNEMONICS: Record<number, string>` — static map keyed by semitone distance (1–12), ≤13 entries, no external data source                                                                                                                                                                                                                                                                                    |
| `src/lib/learning/drills/mistake-explanation.ts`    | **Create** | `explainIntervalMistake(attempt: number, correct: number, key: string \| null): MistakeExplanation`; `explainChordMistake(attempt: ChordQuality, correct: ChordQuality): MistakeExplanation`; `MistakeExplanation` type: `{ text: string; semitoneError?: number; scaleContext?: string; chordRole?: string; mnemonic: string \| null }`                                                                             |
| `src/lib/learning/drills/confusion-pairs.ts`        | **Create** | `buildIntervalConfusionPairs(log: IntervalAttemptEvent[]): Array<[number, number, number]>`; `buildChordConfusionPairs(log: ChordAttemptEvent[]): Array<[ChordQuality, ChordQuality, number]>`; `getTopIntervalConfusionPair(log)` → default pair when log empty; `getTopChordConfusionPair(log)` → default pair when log empty                                                                                      |
| `src/lib/learning/protocols/interval-protocol.ts`   | **Create** | `IntervalDrillConfig` type; `createIntervalSession(config: IntervalDrillConfig): IntervalPrompt[]`; `confusionPairMode: boolean` flag draws from confusion pool                                                                                                                                                                                                                                                      |
| `src/lib/learning/protocols/chord-protocol.ts`      | **Create** | `ChordDrillConfig` type; `createChordSession(config: ChordDrillConfig): ChordPrompt[]`; `confusionPairMode: boolean` flag                                                                                                                                                                                                                                                                                            |
| `src/lib/interval-state.svelte.ts`                  | **Create** | `createIntervalState(seed?: string \| null)` factory; `guess(semitones: number): void`; `current: IntervalPrompt \| null`; `phase: Phase`; `lastResult: IntervalAttemptEvent \| null`; `showExplanation: boolean`; `autoAdvanceTimer` as plain `let` (not `$state`); `destroy(): void`; `createContext` pair `[getIntervalState, setIntervalState]` — SSR-safe, no browser refs at init time                         |
| `src/lib/chord-state.svelte.ts`                     | **Create** | `createChordState(seed?: string \| null)` factory; `guess(quality: ChordQuality): void`; `guessChordTone(tone: ChordToneLabel): void`; `togglePlaybackStyle(): void`; `current: ChordPrompt \| null`; `phase: Phase`; `playbackStyle: 'blocked' \| 'arpeggiated'`; `showExplanation: boolean`; `autoAdvanceTimer` as plain `let`; `destroy(): void`; `createContext` pair — SSR-safe                                 |
| `src/lib/audio.ts`                                  | **Modify** | Add `playChord(frequencies: readonly number[], options: PlayOptions): void` — voices each frequency through its own `GainNode`/`OscillatorNode` chain without calling `stopAll()`. Add `playArpeggiated(frequencies: readonly number[], options: PlayOptions, offsetSeconds: number): () => void` — schedules each onset at `context.currentTime + index * offsetSeconds`; returns a cancel function for `destroy()` |
| `src/lib/components/interval-answer-surface.svelte` | **Create** | 12 interval buttons (minor 2nd through octave); `aria-pressed` per button; `role="group"` container; disabled during non-guessing phase; `data-reveal` attribute for correct/incorrect coloring; `aria-live="polite"` reveal region; emits `onguess: (semitones: number) => void`                                                                                                                                    |
| `src/lib/components/chord-answer-surface.svelte`    | **Create** | Chord quality grid (9 qualities); inversion selector as `<fieldset>` + radio buttons; `aria-pressed` states; emits `onguess: (quality: ChordQuality) => void`                                                                                                                                                                                                                                                        |
| `src/lib/components/chord-tone-surface.svelte`      | **Create** | Five buttons: root/third/fifth/seventh/bass; `aria-pressed`; emits `onguess: (tone: ChordToneLabel) => void`                                                                                                                                                                                                                                                                                                         |
| `src/lib/components/playback-style-toggle.svelte`   | **Create** | Blocked/arpeggiated toggle; `<div role="group" aria-label="Chord playback style">`; `aria-pressed` per button; `aria-live="polite"` announcement on change; emits `ontoggle: (style: 'blocked' \| 'arpeggiated') => void`                                                                                                                                                                                            |
| `src/lib/components/mistake-explanation.svelte`     | **Create** | `role="status"` container; primary text always rendered; mnemonic inside `<details>` (collapsed by default); `open?: boolean` prop; hidden when `explanation` is null                                                                                                                                                                                                                                                |
| `src/lib/components/choice-grid.svelte`             | **Create** | Local stub until Cinder #318 ships: `<div role="group">` of `<button>` elements; props `options: { value: string; label: string; state: 'idle' \| 'correct' \| 'incorrect' \| 'selected' }[]` and `onselect: (value: string) => void`; named exports match the anticipated Cinder API for a one-import swap                                                                                                          |
| `src/routes/intervals/+page.ts`                     | **Create** | Universal `load` returning `{ seed: string \| null }` from `url.searchParams.get('seed')`                                                                                                                                                                                                                                                                                                                            |
| `src/routes/intervals/+page.svelte`                 | **Create** | Interval practice route; instantiates `createIntervalState`; provides via context; renders `interval-answer-surface`, `playback-style-toggle`, `mistake-explanation`; no `+page.server.ts`                                                                                                                                                                                                                           |
| `src/routes/chords/+page.ts`                        | **Create** | Universal `load` returning `{ seed: string \| null }`                                                                                                                                                                                                                                                                                                                                                                |
| `src/routes/chords/+page.svelte`                    | **Create** | Chord practice route; instantiates `createChordState`; provides via context; renders `chord-answer-surface`, `chord-tone-surface`, `playback-style-toggle`, `mistake-explanation`; no `+page.server.ts`                                                                                                                                                                                                              |

### SSR and reactivity invariants (carry forward from Milestone 00)

Both `createIntervalState` and `createChordState` must contain no references to `window`, `document`, `localStorage`, `navigator`, or `AudioContext` at module initialization time. All browser calls go through `getSynth()` (already SSR-guarded) and `localStorageOrNull()` (already SSR-guarded).

The `autoAdvanceTimer` in each factory must be a plain `let` (not `$state`)—it is not reactive—and `destroy()` must call `clearTimeout` on it plus cancel any in-flight arpeggiated playback sequence.

Feedback text, reveal coloring, and current-playback-state indicators are `$derived`—never computed in `$effect`. The `showExplanation` boolean is a plain `$state` in the factory, toggled by a state action, not by an effect watching `lastResult`.

### `IntervalPrompt` and `ChordPrompt` types (defined in `schema.ts`)

```ts
export type IntervalPrompt = {
	promptId: string;
	rootPitch: Pitch;
	targetPitch: Pitch;
	direction: 'ascending' | 'descending' | 'harmonic';
	semitoneDistance: number;
	diatonicDegree: number | null;
	contextKey: string | null;
	timbre: string;
	stimulusType: 'melodic-interval' | 'harmonic-interval';
};

export type ChordPrompt = {
	promptId: string;
	rootPitch: Pitch;
	quality: ChordQuality;
	inversion: 0 | 1 | 2 | 3;
	voicing: 'close' | 'open';
	playbackStyle: 'blocked' | 'arpeggiated';
	chordToneTarget: ChordToneLabel | null;
	timbre: string;
	stimulusType: 'chord-blocked' | 'chord-arpeggiated';
};
```

## Dependencies

- **Milestone 10 (Answer Surfaces, MIDI, and Accessibility):** provides the answer surface architecture (piano, letter buttons, guitar fretboard) and the `answerSurface: string` field on attempt events. Interval construction reuses the single-note selection surface from M10 with two sequential picks—no new surface infra. The `answerSurface` field from M10 is included in `AttemptEventBase` and flows through all new event types.
- **Milestone 03 (Microphone Pitch-Detection Spike):** provides the GO/NO-GO feasibility decision in `docs/spikes/microphone-feasibility.md` and the `src/lib/audio/microphone.ts` primitives. Required only for the interval singing branch. If milestone 03's result is NO-GO, that branch is dropped and there is no dependency on Milestone 03's runtime code.

The source file for this milestone listed "Milestone 07 Functional and Singer Tracks" as a dependency. Under the final canonical numbering that corresponds to Milestone 11 (Relative Pitch and Singer Track), which is **not** a dependency here. In-key interval context is implemented directly using `KEYS`, `majorScalePitchClasses`, `scalePitchClassSet`, and `pitchToMidi` from the existing `src/lib/music.ts`, which already exports these functions. No tonic-drone or cadence infrastructure from M11 is required.

## External Dependency Contracts

| Capability                                           | Owner                                                                                                                                                                     | Contract needed                                                                              | Stub/mock plan                                                                                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interval semitone distance from two pitches          | Octavian root export (check `octavian@3.0.0`); [Octavian #17](https://github.com/stevekinney/octavian/issues/17)/[#18](https://github.com/stevekinney/octavian/issues/18) | `intervalBetween(a: Pitch, b: Pitch): { semitones: number; diatonicDegree: number \| null }` | Local `interval-stub.ts`: `semitones = pitchToMidi(b) - pitchToMidi(a)`; `diatonicDegree` derived from `majorScalePitchClasses` in `music.ts`. Swap with upstream export when available.                      |
| Chord voiced pitches from root + quality + inversion | Octavian root export (check `octavian@3.0.0`); [Octavian #21](https://github.com/stevekinney/octavian/issues/21)                                                          | `buildChord(root: PitchClass, quality: ChordQuality, inversion: number): PitchClass[]`       | Local `chord-stub.ts`: `CHORD_INTERVALS as const` table for all 9 supported qualities; rotate array by inversion index.                                                                                       |
| Deterministic drill generation (seeded RNG)          | [Octavian #28](https://github.com/stevekinney/octavian/issues/28)                                                                                                         | `seededRandomInt(seed: string): RandomInt`                                                   | Already implemented locally in `src/lib/learning/drills/seeded-random.ts` (Milestone 00). Import and reuse directly—no new stub needed.                                                                       |
| Timed sequence for arpeggiated playback              | [Octavian #30](https://github.com/stevekinney/octavian/issues/30)                                                                                                         | Sequence of `{ frequencyHz, onsetSeconds }` events                                           | `playArpeggiated` on `Synth` (new method in `audio.ts`): uses `context.currentTime + index * offsetSeconds` (100 ms default gap). Swap with `octavian/sequences` when #30 ships.                              |
| Answer comparison / enharmonic equivalence           | [Octavian #35](https://github.com/stevekinney/octavian/issues/35)                                                                                                         | `semitoneEquals(a: number, b: number): boolean`                                              | Local stub in `interval-stub.ts`: `a % 12 === b % 12`. Already partially covered by `pitchClassEquals` from Milestone 00's `schema.ts`.                                                                       |
| Chromatic harmony helpers (aug/dim chords)           | [Octavian #21](https://github.com/stevekinney/octavian/issues/21)                                                                                                         | Augmented/diminished quality enum                                                            | Include `'dim'` and `'aug'` in local `CHORD_INTERVALS` table using standard semitone offsets `[0,3,6]` and `[0,4,8]`. No upstream call needed for basic triad support.                                        |
| Answer grid component                                | [Cinder #318](https://github.com/stevekinney/cinder/issues/318)                                                                                                           | `ChoiceGrid` with props `options: { value, label, state }[]` and `onselect: (value) => void` | Local `src/lib/components/choice-grid.svelte` stub: `<div role="group">` of `<button>` elements with `aria-pressed` and `data-state`. Props match the Cinder #318 spec so the swap is a single import change. |
| Progressions / cadence setup                         | [Octavian #22](https://github.com/stevekinney/octavian/issues/22)                                                                                                         | `buildCadence(key, style): Note[][]`                                                         | Explicitly out of scope for M12 (non-goal: no harmonic dictation). Not needed.                                                                                                                                |
| Voice-leading analysis                               | [Octavian #23](https://github.com/stevekinney/octavian/issues/23)                                                                                                         | Not needed for M12                                                                           | Explicitly out of scope. Not needed.                                                                                                                                                                          |

## Acceptance Criteria

Each criterion is a concrete pass/fail check. **[auto]** must pass in CI; **[manual]** require recorded observation; **[e2e]** require a Playwright spec that references a named test in the Test Plan.

### Interval identification

1. **[auto]** Given any two `Pitch` values, `intervalBetween(a, b)` returns `{ semitones: number; diatonicDegree: number | null }`. For a prompt with a context key set, `diatonicDegree` is an integer 1–7. For a context-free prompt, `diatonicDegree` is `null` and `contextKey` is `null`.
2. **[auto]** `scoreIntervalAnswer(answer, correct)` returns `true` when the semitone counts match or are enharmonically equivalent (`a % 12 === b % 12`), and `false` otherwise.
3. **[auto]** An `IntervalAttemptEvent` built after any guess contains all required fields: `drillType: 'interval'`, `direction`, `semitoneDistance`, `diatonicDegree`, `contextKey`, `answer`, `correctAnswer`, `correct`, `responseTimeMs`, `explanationShown`, `answerSurface`, `timestamp`, `version: 2`.
4. **[e2e]** A learner can select ascending, descending, or harmonic direction from the interval session setup and the prompt playback changes accordingly: ascending plays low then high, descending plays high then low, harmonic plays both notes simultaneously.

### Interval construction

5. **[auto]** `validateIntervalConstruction(root, selected, targetSemitones)` returns `true` when the semitone distance between `root` and `selected` (via `pitchToMidi`) matches `targetSemitones`, enharmonically (`% 12`). Returns `false` otherwise.
6. **[e2e]** On the piano answer surface a learner selects a root note then a second note; the UI highlights both and displays the interval name before confirming. Selecting a wrong second note shows incorrect state.

### Chord identification

7. **[auto]** Given a `ChordQuality` and inversion, `buildChord(root, quality, inversion)` returns a `PitchClass[]` of the correct length (3 for triads, 4 for sevenths) with the correct lowest note for the given inversion.
8. **[auto]** `scoreChordAnswer(answer, correct)` returns `true` when qualities match and `false` otherwise.
9. **[e2e]** Blocked and arpeggiated playback are audibly distinct: blocked plays all chord notes simultaneously; arpeggiated plays them in ascending order with a ~100 ms inter-note gap. The learner can toggle playback style before answering.

### Chord-tone recognition

10. **[auto]** `scoreChordToneAnswer(answer, correct)` returns `true` when `answer === correct` and `false` otherwise. When `chordToneTarget` is `'seventh'` and the prompt chord quality is a triad, `createChordSession` throws a typed `InvalidChordToneError` before returning.
11. **[e2e]** A learner hears a chord, then hears one isolated chord tone and identifies it (root / third / fifth / seventh / bass) using the `chord-tone-surface` buttons. Correct identification shows a `data-reveal="correct"` state; incorrect shows `data-reveal="incorrect"` with the correct label visible.

### Explain-my-mistake feedback

12. **[auto]** `explainIntervalMistake(attempt, correct, key)` returns a `MistakeExplanation` containing `text` (non-empty string), `semitoneError` (signed integer), and `mnemonic` (string from `INTERVAL_MNEMONICS` when the semitone distance has an entry, otherwise `null`). When `key` is non-null, `scaleContext` is a non-empty string describing the diatonic degree.
13. **[auto]** `explainChordMistake(attempt, correct)` returns a `MistakeExplanation` with `text` describing the quality difference. It never returns `mnemonic` for chord mistakes (chord mnemonics are out of scope).
14. **[auto]** `INTERVAL_MNEMONICS` has entries for semitone distances 1 through 12 (all 12 chromatic intervals); each value is a non-empty string. The map never exceeds 13 entries (m2 through P8).
15. **[e2e]** After answering an interval incorrectly, the feedback panel appears showing: the correct interval name, the signed semitone error as text (e.g., "You were 2 semitones short"), and the mnemonic if available. No feedback panel appears after a correct answer unless the learner is already viewing one from a prior guess.

### Analytics event shape

16. **[auto]** `IntervalAttemptEvent` round-trips through `JSON.stringify` / `JSON.parse` with all required fields present and typed correctly. No field is `undefined` after round-trip.
17. **[auto]** `ChordAttemptEvent` and `ChordToneAttemptEvent` round-trip identically.
18. **[auto]** `getIntervalConfusionPairs()` (filtering the log by `drillType === 'interval'`) returns zero chord or note events. `getChordConfusionPairs()` returns zero interval or note events. `getApConfusionPairs()` returns zero interval or chord events.

### Track isolation

19. **[auto]** AP note confusion matrix queries (`getApConfusionPairs()`) return zero interval or chord events from the log.
20. **[e2e]** An AP learner can complete a full 10-round AP session without the interval or chord drill UI appearing in navigation or recommendation surfaces.

### Microphone / interval singing (if GO branch is active)

21. **[auto]** Interval singing attempt events store only `{ detectedNote, centsOffset, clarityScore, uncertain }` derived fields—not raw audio, `Float32Array`, or `MediaStream` references. Assertable via a `localStorage.setItem` spy confirming no `Float32Array` data.
22. **[auto]** The mic stream stops when the interval singing drill exits. Assertable via a mock `MediaStreamTrack.readyState` spy confirming `'ended'` state.

### Accessibility

23. **[auto]** Interval answer buttons expose `aria-pressed` for selected state. Correct/incorrect states are communicated via `role="status"` text—not by color alone.
24. **[e2e]** A learner can complete one interval identification drill using keyboard only: Tab to the answer surface, Tab/arrow-key navigation through options, Enter to confirm, and read the feedback from the `role="status"` region with no mouse interaction.

## Test Plan

### Unit tests — `src/lib/learning/drills/`

**`src/lib/learning/drills/schema.spec.ts`** (extend existing):

- `drill-schema: IntervalAttemptEvent round-trips through JSON with all required fields including version 2 and drillType "interval"`
- `drill-schema: ChordAttemptEvent round-trips through JSON with all required fields including version 2 and drillType "chord"`
- `drill-schema: ChordToneAttemptEvent round-trips through JSON with all required fields`
- `drill-schema: AttemptEvent discriminated union narrows correctly on drillType === "interval"`
- `drill-schema: loadAttemptLog normalizes v1 records (missing drillType) to drillType "note" without losing any fields`
- `drill-schema: loadAttemptLog does not discard pre-existing note events after the version 2 extension`

**`src/lib/learning/drills/interval-stub.spec.ts`**:

- `interval-stub: intervalBetween C4 to E4 returns semitones 4`
- `interval-stub: intervalBetween G4 to C4 returns semitones -7 (descending)`
- `interval-stub: intervalBetween C4 to F#4 returns semitones 6 (tritone)`
- `interval-stub: diatonicDegree is 2 for D in C major context (KeyDefinition id "C")`
- `interval-stub: diatonicDegree is null in context-free (null key) mode`
- `interval-stub: scoreIntervalAnswer returns true when answer equals correctAnswer`
- `interval-stub: scoreIntervalAnswer returns false when answer differs by 1 semitone`
- `interval-stub: scoreIntervalAnswer treats augmented fourth and diminished fifth as equal (enharmonic % 12)`
- `interval-stub: validateIntervalConstruction: C4 root and E4 selected validates as major third (4 semitones) correct`
- `interval-stub: validateIntervalConstruction: C4 root and D4 selected validates as major third incorrect`
- `interval-stub: validateIntervalConstruction: enharmonic target (D#4 vs Eb4) scores as correct`

**`src/lib/learning/drills/chord-stub.spec.ts`**:

- `chord-stub: root-position C major triad returns pitch classes [0, 4, 7]`
- `chord-stub: first-inversion C major triad has E as lowest pitch class`
- `chord-stub: second-inversion C major triad has G as lowest pitch class`
- `chord-stub: G dominant-seventh chord returns pitch classes [7, 11, 2, 5]`
- `chord-stub: diminished triad has interval content [0, 3, 6]`
- `chord-stub: augmented triad has interval content [0, 4, 8]`
- `chord-stub: half-diminished seventh has interval content [0, 3, 6, 10]`
- `chord-stub: scoreChordAnswer returns true for matching quality`
- `chord-stub: scoreChordAnswer returns false for wrong quality same root`
- `chord-stub: scoreChordToneAnswer returns true when guessed tone matches targetChordTone`
- `chord-stub: scoreChordToneAnswer returns false when guessed tone is adjacent`
- `chord-stub: chordToFrequencies returns 3 frequencies for a triad and 4 for a seventh chord`
- `chord-stub: createChordSession throws InvalidChordToneError when targetChordTone is seventh and quality is a triad`

**`src/lib/learning/drills/mistake-explanation.spec.ts`**:

- `mistake-explanation: explainIntervalMistake wrong by 2 semitones returns semitoneError 2`
- `mistake-explanation: explainIntervalMistake wrong by -1 semitone returns signed semitoneError -1`
- `mistake-explanation: explainIntervalMistake with in-key context returns non-empty scaleContext`
- `mistake-explanation: explainIntervalMistake context-free returns scaleContext undefined or null`
- `mistake-explanation: explainIntervalMistake for P5 (7 semitones) returns non-null mnemonic string`
- `mistake-explanation: explainIntervalMistake for a semitone distance with no INTERVAL_MNEMONICS entry returns mnemonic null`
- `mistake-explanation: explainIntervalMistake never throws when mnemonic slot is absent`
- `mistake-explanation: explainChordMistake quality mismatch (maj vs min) returns non-empty text`
- `mistake-explanation: explainChordMistake returns no mnemonic field for chord mistakes`
- `mistake-explanation: INTERVAL_MNEMONICS covers all 12 semitone distances (1–12) with non-empty strings`
- `mistake-explanation: INTERVAL_MNEMONICS has no more than 13 entries`

**`src/lib/learning/drills/confusion-pairs.spec.ts`**:

- `confusion-pairs: buildIntervalConfusionPairs returns empty array when log has no interval events`
- `confusion-pairs: buildIntervalConfusionPairs counts each wrong-answer pair once per incorrect attempt`
- `confusion-pairs: buildIntervalConfusionPairs returns pairs sorted by count descending`
- `confusion-pairs: buildChordConfusionPairs returns only chord events—zero interval or note events counted`
- `confusion-pairs: getTopIntervalConfusionPair returns [3, 4, 0] (minor 3rd vs major 3rd default) when log is empty`
- `confusion-pairs: getTopChordConfusionPair returns ["maj", "min", 0] default when log is empty`

**`src/lib/learning/protocols/interval-protocol.spec.ts`**:

- `interval-protocol: createIntervalSession returns the requested number of prompts`
- `interval-protocol: ascending-only config yields no descending or harmonic prompts`
- `interval-protocol: in-key config yields only diatonic intervals for the given key`
- `interval-protocol: identical seed yields identical prompt sequence (deepEqual over N=8)`
- `interval-protocol: confusionPairMode draws only from the provided confusion pool`

**`src/lib/learning/protocols/chord-protocol.spec.ts`**:

- `chord-protocol: createChordSession returns the requested number of prompts`
- `chord-protocol: triads-only config yields no seventh-chord prompts`
- `chord-protocol: chord-tone mode sets non-null chordToneTarget on every prompt`
- `chord-protocol: identical seed yields identical prompt sequence (deepEqual over N=8)`

### Unit tests — `src/lib/audio.spec.ts` (extend existing)

- `audio: playChord schedules multiple oscillators without calling stopAll()`
- `audio: playChord routes each frequency through its own GainNode chain`
- `audio: playArpeggiated schedules each onset at currentTime + index * offsetSeconds`
- `audio: playArpeggiated cancel function stops all scheduled sources`

### Component tests — vitest-browser-svelte (`client` project)

**`src/lib/components/interval-answer-surface.svelte.test.ts`**:

- `interval-answer-surface: renders 12 interval buttons`
- `interval-answer-surface: each button has an accessible name matching the interval label`
- `interval-answer-surface: clicking a button emits onguess with the correct semitone count`
- `interval-answer-surface: all buttons are Tab-reachable in guessing phase`
- `interval-answer-surface: Enter on a focused button emits onguess`
- `interval-answer-surface: buttons are disabled and carry aria-disabled during revealed phase`
- `interval-answer-surface: correct button has data-reveal="correct" after reveal`
- `interval-answer-surface: guessed incorrect button has data-reveal="incorrect" after reveal`
- `interval-answer-surface: aria-live region contains interval name after reveal`
- `interval-answer-surface: does not overflow at 375px viewport width`

**`src/lib/components/chord-answer-surface.svelte.test.ts`**:

- `chord-answer-surface: renders all 9 supported chord quality buttons`
- `chord-answer-surface: each quality button has an accessible name`
- `chord-answer-surface: clicking a quality button emits onguess with the ChordQuality value`
- `chord-answer-surface: inversion selector is rendered as fieldset with legend`
- `chord-answer-surface: all quality buttons are Tab-reachable`
- `chord-answer-surface: does not overflow at 375px viewport width`

**`src/lib/components/chord-tone-surface.svelte.test.ts`**:

- `chord-tone-surface: renders root, third, fifth, seventh, and bass buttons`
- `chord-tone-surface: clicking a button emits onguess with the ChordToneLabel value`
- `chord-tone-surface: all buttons have aria-pressed state`

**`src/lib/components/playback-style-toggle.svelte.test.ts`**:

- `playback-style-toggle: blocked button has aria-pressed true when style is blocked`
- `playback-style-toggle: arpeggiated button has aria-pressed true when style is arpeggiated`
- `playback-style-toggle: clicking arpeggiated emits ontoggle with "arpeggiated"`
- `playback-style-toggle: aria-live region updates text when style changes`

**`src/lib/components/mistake-explanation.svelte.test.ts`**:

- `mistake-explanation: not rendered when explanation prop is null`
- `mistake-explanation: container has role="status" when explanation is non-null`
- `mistake-explanation: primary text is rendered unconditionally when explanation is non-null`
- `mistake-explanation: mnemonic is inside a details element when explanation.mnemonic is non-null`
- `mistake-explanation: mnemonic section is absent when explanation.mnemonic is null`
- `mistake-explanation: details element is collapsed by default`

### Playwright E2E tests (`e2e/`)

All specs use the `.e2e.ts` extension (required by `playwright.config.ts` `testMatch: '**/*.e2e.{ts,js}'`).

**`e2e/interval-drill.e2e.ts`**:

- `interval-drill-happy-path [375×667]: play → hear ascending interval → select correct answer → see reveal → auto-advance`
- `interval-drill-happy-path [768×1024]: same flow at tablet width — all controls visible and interactive`
- `interval-drill-happy-path [1280×800]: same flow at desktop width`
- `interval-drill-direction-descending [1280×800]: descending direction plays high note before low note`
- `interval-drill-direction-harmonic [1280×800]: harmonic direction plays both notes simultaneously`
- `interval-drill-in-key [1280×800]: with C major context key selected, scale-context text appears in mistake feedback after incorrect guess`
- `interval-drill-context-free [1280×800]: with no context key, scale-context text is absent from mistake feedback`
- `interval-drill-keyboard-path [1280×800]: Tab to play button → Enter → Tab through interval buttons → Enter submits guess → focus ring visible throughout`
- `interval-drill-mistake-feedback [1280×800]: incorrect guess shows mistake-explanation panel with semitone error text and correct interval name`
- `interval-drill-mistake-feedback-disappears [1280×800]: mistake-explanation panel is absent after advancing to the next prompt`
- `interval-drill-construction [1280×800]: selecting root then second note on piano surface highlights both and displays interval name`
- `interval-drill-construction-incorrect [1280×800]: selecting wrong second note shows incorrect state`
- `interval-drill-local-storage [1280×800]: after 5 guesses localStorage contains 5 IntervalAttemptEvent objects with drillType "interval" and all required fields`
- `interval-drill-seeded [1280×800]: loading /intervals?seed=abc123 produces same first prompt across two browser sessions`
- `interval-drill-screen-reader [1280×800]: role="status" region contains non-empty text after incorrect guess`
- `interval-drill-no-overflow [375×667]: interval answer surface renders without horizontal overflow`
- `interval-drill-no-overflow [768×1024]: interval answer surface renders without overflow at tablet width`

**`e2e/chord-drill.e2e.ts`**:

- `chord-drill-happy-path [375×667]: play blocked chord → select quality → see reveal → auto-advance`
- `chord-drill-happy-path [768×1024]: same flow at tablet width`
- `chord-drill-happy-path [1280×800]: same flow at desktop width`
- `chord-drill-arpeggiated [1280×800]: toggle to arpeggiated → play → playback-style-toggle shows aria-pressed="true" on arpeggiated button`
- `chord-drill-arpeggiated-persists [1280×800]: switching to arpeggiated and reloading preserves arpeggiated selection`
- `chord-drill-chord-tone [1280×800]: chord-tone sub-mode renders root/third/fifth/seventh/bass buttons and correct guess emits ChordToneAttemptEvent`
- `chord-drill-keyboard-path [1280×800]: Tab through playback-style toggle → Tab through chord quality buttons → Enter submits guess; focus ring visible on every stop`
- `chord-drill-mistake-feedback [1280×800]: incorrect chord guess shows mistake-explanation with quality mismatch text`
- `chord-drill-local-storage [1280×800]: after 5 chord guesses localStorage contains 5 ChordAttemptEvent objects with all required fields`
- `chord-drill-screen-reader [1280×800]: chord prompt element carries aria-label describing quality and inversion`
- `chord-drill-no-overflow [375×667]: chord quality buttons and chord-tone buttons visible without overflow`

**`e2e/ap-track-isolation.e2e.ts`** (extend or add to existing AP drill spec):

- `ap-learner-no-forced-intervals [1280×800]: AP learner completes 10 rounds without interval or chord prompts appearing in navigation or recommendations`

### Manual audio smokes (not CI-automatable; document in PR description before merge)

| Scenario                                             | Expected outcome                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Chrome: harmonic interval (e.g. C4 + E4)             | Two simultaneous pitches audible as a single chord-like event; no gap between onsets |
| Chrome: melodic ascending interval (e.g. C4 then E4) | Notes play sequentially; gap between onsets is clearly perceptible                   |
| Chrome: melodic descending interval                  | Same as ascending but order reversed                                                 |
| Chrome: blocked major triad                          | All three notes sound simultaneously; no ramp-down between them                      |
| Chrome: arpeggiated dominant seventh chord           | Four notes sound in sequence with a consistent ~100 ms inter-note gap                |
| Safari: all five scenarios above                     | Identical behavior to Chrome                                                         |

## Verification

Run all four gates before declaring the milestone complete:

```
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

**AP-claims guard (grep gate):**

```
grep -rE "perfect pitch|guaranteed|will learn" src/
```

Must return no matches.

**Analytics fields smoke:** Open DevTools → Application → Local Storage after an interval session and a chord session. Confirm `vibratone:attempts:v1` contains at least one event with `drillType: "interval"` and all `IntervalAttemptEvent` fields, and at least one with `drillType: "chord"` and all `ChordAttemptEvent` fields. Confirm pre-existing note events remain in the log and are not discarded.

**Manual audio smokes:** See the named list in the Test Plan. Record pass/fail in the PR description before merging.

## Non-Goals

- Do not add chromatic harmony, secondary dominants, modal interchange, or jazz substitutions. These belong to a dedicated harmony milestone after the Theory Explorers milestone ships.
- Do not build full harmonic dictation or multi-voice listening.
- Do not add staff notation requirements. Staff exercises belong to a later notation milestone.
- Do not require interval or chord drills as mandatory steps in the AP or Relative Pitch progression. These are opt-in supporting skills.
- Do not add more than 13 interval mnemonics. The static map is a display aid only—it does not affect scoring, FSRS cards, or analytics.
- Do not build interval singing if `docs/spikes/microphone-feasibility.md` records NO-GO. That scope becomes a separate follow-up milestone.
- Do not persist raw microphone audio, `AudioBuffer` samples, `Float32Array` data, or `MediaStream` tracks anywhere—including `localStorage`, `sessionStorage`, `IndexedDB`, or any network surface.
- Do not use `setTimeout` for audio scheduling. All onset timing uses `AudioContext.currentTime` offsets.
- Do not introduce a database, accounts, cloud sync, or teacher workflows.
- Do not build Octavian #22 (chord progressions) or #23 (voice-leading analysis) functionality. Those issues are explicitly not consumed here.

## Completion Signal

This milestone is complete when:

1. `bun run check`, `bun run lint`, `bun run test:unit -- --run`, and `bun run test:e2e` all exit clean with zero new failures.
2. All named unit tests in the Test Plan exist and pass.
3. All named component tests in the Test Plan exist and pass.
4. All named Playwright specs in the Test Plan exist and pass at all stated viewport sizes.
5. `localStorage` contains at least one `IntervalAttemptEvent` with all required fields and at least one `ChordAttemptEvent` with all required fields after manual browser smoke on Chrome.
6. Pre-existing AP note events (from Milestone 00 / 02 drill sessions) remain visible in `localStorage` and are not discarded by the `loadAttemptLog` migration guard.
7. The explain-my-mistake panel shows semitone distance text and a named correct answer for at least one incorrect interval guess and at least one incorrect chord guess in a manual browser smoke.
8. All named manual audio smokes are recorded as passing in the PR description.
9. The AP track navigation shows no interval or chord drill entries in the primary surface (verified by the `ap-learner-no-forced-intervals` Playwright spec).
10. The grep gate returns no matches for AP-efficacy phrases.
