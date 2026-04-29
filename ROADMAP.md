# Octavian Roadmap

A music-theory-driven roadmap to evolve Octavian from an excellent pitch/chord library into a
comprehensive music theory library. Organized for **maximum parallel execution**: each top-level
item lists its dependencies, and items in the same "wave" can be implemented simultaneously by
independent agents or contributors.

## How to read this roadmap

- **Phases** group work by pedagogical priority (Phase 1 = first-semester theory; Phase 4 =
  post-tonal and specialized).
- **Waves** within a phase are parallelizable: every item in a wave can ship independently.
- **Dependencies** are listed explicitly. If an item lists no dependencies, it can start
  immediately.
- **Acceptance criteria** are concrete, testable checklists. Each item ships when every box is
  checked.
- **Out of scope** notes appear where a tempting feature is intentionally deferred.

## Conventions for every item

Unless otherwise stated, every item below must satisfy these baseline acceptance criteria before it
ships. Item-specific checklists assume these are also done.

- [ ] All new public types and functions exported from `src/index.ts`
- [ ] 100% test coverage for new code (`bun test --coverage`)
- [ ] Type-correct under `bun run typecheck` and `bun run typecheck:test`
- [ ] Lints clean under `bun run lint`
- [ ] Catalog entries (where applicable) follow the canonical-key + alias pattern used by
      `INTERVALS`, `CHORDS`, `SCALES`
- [ ] Validation at trust boundaries via branded types or type guards
- [ ] No Bun-only runtime APIs in `src/` (Node-compatible)
- [ ] README updated with at least one usage example for the new feature
- [ ] `bun run validate` passes end-to-end

---

# Phase 1 — Tonal Harmony Foundation

The keystone phase. After Phase 1, Octavian can answer the questions a first-year theory student is
taught to answer: what key am I in, what are the chords, what's the function, what's the cadence.

## Wave 1.A — Independent foundations (run in parallel)

These four items have no dependencies on each other and should be dispatched simultaneously.

### 1.1 Key signature catalog

Add a complete catalog of key signatures as data, separate from the existing `KeySignature` type.

- [x] `KEY_SIGNATURES` catalog in `src/key-signatures.ts` covering all 30 standard keys (15 major +
      15 minor, including enharmonic doubles like C♯/D♭ major and A♯/B♭ minor)
- [x] Each entry includes
      `{ tonic, mode, accidentalCount, accidentals: NoteName[], order: 'sharps' | 'flats' | 'none' }`
- [x] Order of accidentals matches notation convention (sharps: F♯ C♯ G♯ D♯ A♯ E♯ B♯; flats: B♭ E♭
      A♭ D♭ G♭ C♭ F♭)
- [x] `keySignatureFor(tonic, mode)` lookup function
- [x] `keySignatureFromAccidentals(count, order)` reverse lookup
- [x] Catalog handles theoretical keys (G♯ major, F♭ major) behind
      `accidentalPreference: 'theoretical'`
- [x] Round-trip property test: every entry's accidentals correctly spell its scale

### 1.2 Interval inversion and simplification

Model the relationships between simple and compound intervals.

- [x] `invertInterval(name)` returns the inversion (P5 → P4, M3 → m6, A4 → d5, P1 → P8)
- [x] `simplifyInterval(name)` reduces compound intervals to their simple form (P11 → P4, M9 → M2)
- [x] `compoundInterval(name, octaves)` extends a simple interval (P4 + 1 octave → P11)
- [x] `simpleInterval` field added to every `INTERVALS` catalog entry
- [x] `octaveOffset` field added (0 for simple, 1+ for compound)
- [x] Property test: `invert(invert(x))` returns to a pitch-class-equivalent simple form
- [x] Property test: `simplify(compound(x, n)) === x` for catalog-supported simple intervals

### 1.3 Consonance and dissonance classification

- [x] `IntervalConsonance` taxonomy exposed via `consonanceOf(name)` (returns
      `'perfect-consonance' | 'imperfect-consonance' | 'mild-dissonance' | 'sharp-dissonance'`).
      Implementation note: classification is a function rather than a field on `IntervalInformation`
      to keep a single source of truth.
- [x] Standard taxonomy: P1/P8/P5 = perfect consonance; P4 = perfect (with note about contextual
      dissonance); M3/m3/M6/m6 = imperfect; M2/m7 = mild dissonance; m2/M7/A4/d5 = sharp dissonance
- [x] `isConsonant(name)`, `isDissonant(name)` predicates (also `consonanceOf(name)` for the full
      classification)
- [x] Documented note in source comments explaining the perfect-fourth ambiguity (consonant
      melodically, dissonant against bass)
- [x] Tests verify classification for every catalog entry

### 1.4 Triple accidentals (data layer only)

Lay groundwork for theoretically correct spelling under deep modulation. Public API surfacing is in
Wave 1.B.

- [x] `ACCIDENTALS` extended to include `'###'`, `'bbb'` (triple sharp / triple flat)
- [x] `ACCIDENTAL_OFFSETS` updated with `+3` and `-3`
- [x] `ALL_NOTE_NAMES` regenerated to include triple-accidental spellings (49 total)
- [x] `enharmonicsForNoteName` returns triple-accidental forms when relevant
- [x] `simplifyNoteName` reduces triple accidentals to simpler enharmonic equivalents
- [x] Documentation note: triple accidentals are valid but typically only appear in extreme
      theoretical contexts

## Wave 1.B — Depends on Wave 1.A

### 1.5 Circle of fifths

**Depends on:** 1.1 (Key signature catalog)

- [x] `CIRCLE_OF_FIFTHS_MAJOR` and `CIRCLE_OF_FIFTHS_MINOR` arrays in canonical clockwise order
      starting from C major / A minor
- [x] `circleOfFifths(mode?)` accessor returning the full ordering
- [x] `Key.distanceInFifths(from, to)` returns signed integer (positive clockwise)
- [x] `Key.adjacentKeys(key)` returns dominant and subdominant neighbors (with per-direction
      spelling overrides at the F♯/G♭ seam)
- [x] `Key.enharmonicEquivalent(key)` returns the other spelling at the bottom of the circle (F♯ ↔
      G♭, etc.)
- [x] Renders correctly for both major and minor positions on the circle
- [x] Tests cover wrap-around behavior and enharmonic equivalence

### 1.6 The `Key` class — central abstraction

**Depends on:** 1.1, 1.5

This is the keystone abstraction. Once this lands, much of Phase 1 and Phase 2 builds on it.

- [x] `Key.create(tonic, mode)` static factory (rejects theoretical keys; use `keySignatureFor` for
      catalog-only access)
- [x] `Key.fromJSON()` round-trip
- [x] Properties: `tonic`, `mode`, `signature` (KeySignatureInformation), `scale` (Scale),
      `relativeKey`, `parallelKey`, `dominantKey`, `subdominantKey`
- [x] `key.diatonicChords()` returns all seven diatonic triads (Roman-numeral integration in 1.7)
- [x] `key.diatonicSeventhChords()` likewise for sevenths
- [x] `key.contains(chord)` membership test
- [x] `key.contains(note)` membership test (pitch class)
- [x] `key.transpose(interval)` and `key.transposeBy(semitones)` return a new `Key` (with
      enharmonic-fallback through `resolveStandardKey`)
- [x] `key.equals(other)`, `key.isEnharmonicTo(other)`
- [x] Immutable with private `#fields`, matches existing `Note`/`Chord`/`Scale` conventions
- [x] Exported from `src/index.ts`

## Wave 1.C — Depends on `Key`

### 1.7 Roman numeral analysis

**Depends on:** 1.6 (Key)

- [x] `RomanNumeral` value type with `{ degree, quality, inversion, applied?, alteration? }`
- [x] `romanNumeralFor(key, chord)` → `'V7'`, `'ii°'`, etc. (returns `null` for non-diatonic chords;
      v1 doesn't yet recognize chromatic mediants — extended in 2.11/2.12). Free function rather
      than `key.romanNumeralFor` to avoid a static circular import between `key.ts` and the
      Roman-numeral module.
- [x] `chordFromRomanNumeral(key, 'V7')` → `Chord` (free function for the same reason)
- [x] Quality follows scale-degree convention (uppercase = major/augmented, lowercase =
      minor/diminished, ° = diminished, ⁺ = augmented)
- [x] Supports flat/sharp prefixes for chromatic degrees (♭III, ♯iv°) on chord construction
- [x] Supports inversion figures (V⁶, V⁶₅, V⁴₃, V⁴₂) — coordinate with item 1.9
- [x] Parser tolerates Unicode and ASCII forms (`bVII`, `♭VII`, `V7`, `V⁷`)
- [x] Round-trip test: parse → render → parse yields the same value
- [x] Handles all major-key and minor-key conventions (i, ii°, III, iv, v/V, VI, VII/vii°)

### 1.8 Harmonic function classification

**Depends on:** 1.6, 1.7

- [x] `HarmonicFunction` type: `'tonic' | 'predominant' | 'dominant'`
- [x] `harmonicFunctionFor(key, chord)` returns the function (or `null` if non-functional). Free
      function for the same circular-import reason as 1.7 — `key.functionOf` would require a static
      cycle.
- [x] Classification respects mode: I/iii/vi are tonic in major; i/III/VI in minor
- [x] Predominant: ii (and ii°), IV (and iv). vi is classified as tonic per the more standard
      tonic-substitute convention; `harmonicFunctionForAsAlias` provides the `'subdominant'` synonym
      for callers who prefer that vocabulary.
- [x] Dominant: V (V⁷), vii° (vii°⁷), VII in minor. The III-as-dominant convention is
      pedagogy-specific and is not classified as dominant in v1; III in minor is tonic.
- [x] Optional `'subdominant'` alias via `harmonicFunctionForAsAlias`
- [x] Tests cover function classification for all 7 triads + 7 sevenths in major and minor
- [x] Documentation explains the function-vs-substitution distinction in the `HarmonicFunction`
      JSDoc

### 1.9 Figured bass notation

**Depends on:** 1.6 (for context); can run parallel to 1.7 once 1.6 lands

- [ ] `FiguredBass` type with stacked figures (`['6', '4']` for second inversion)
- [ ] `Chord.figuredBass(inversion)` → standard figure (5/3, 6, 6/4, 6/5, 4/3, 4/2)
- [ ] `chord.fromFiguredBass(bass, figures, key)` resolves a figured bass to a chord
- [ ] Renders both stacked notation (for display) and inline (`6/4`)
- [ ] Supports accidentals on figures (`6♯`, `♭7`)
- [ ] Coordinates with Roman numeral inversion figures (item 1.7)
- [ ] Tests cover all standard inversions for triads and seventh chords
- [ ] Property test: figure → chord → figure round-trips

### 1.10 Cadence detection

**Depends on:** 1.6, 1.7, 1.8

- [ ] `CadenceType`:
      `'authentic-perfect' | 'authentic-imperfect' | 'half' | 'plagal' | 'deceptive' | 'phrygian'`
- [ ] `key.identifyCadence(chordA, chordB)` returns `CadenceType | null`
- [ ] PAC vs IAC distinguished by soprano position (requires voicing context — accept either
      explicit voicing or chord-symbol-only "best effort" mode)
- [ ] Half cadence: anything → V
- [ ] Plagal: IV → I
- [ ] Deceptive: V → vi (major) or V → VI (minor)
- [ ] Phrygian: iv⁶ → V in minor
- [ ] `key.identifyCadenceSequence(chords)` finds cadences in a longer progression
- [ ] Tests cover all cadence types with both Roman-numeral input and `Chord` input

---

# Phase 2 — Harmonic Richness

After Phase 1 the library handles common-practice tonal music. Phase 2 extends into chromatic
harmony, jazz, and modal mixture.

## Wave 2.A — Independent extensions (run in parallel)

### 2.1 Altered dominants in chord catalog

No dependencies. Can ship immediately.

- [ ] Add to `CHORDS` catalog: `dominantSevenFlatNine`, `dominantSevenSharpNine`,
      `dominantSevenFlatFive`, `dominantSevenSharpFive`, `dominantSevenSharpEleven`,
      `dominantSevenFlatThirteen`
- [ ] Add `dominantNineFlatFive`, `dominantNineSharpFive` (9th chords with altered fifths)
- [ ] Add `dominantThirteenFlatNine`, `dominantThirteenSharpEleven`,
      `dominantThirteenFlatNineSharpEleven`
- [ ] Add `dominantSevenAlt` (the ambiguous "alt" chord — document interval choice in source
      comment)
- [ ] All entries get standard chord symbols (`7♭9`, `7♯9`, `7♭5`, `7♯5`, `7♯11`, `7alt`, `13♭9`,
      etc.)
- [ ] Aliases for ASCII forms (`7b9`, `7#9`, `7#5`)
- [ ] `chordQualityForSuffix` returns `'altered'` for these where appropriate
- [ ] Tests verify construction, transposition, and inversion for every new entry
- [ ] Tests verify symbol parsing for both Unicode and ASCII forms

### 2.2 Modes of melodic minor

No dependencies on Phase 1. Pure catalog extension.

- [ ] Add to `SCALES`: `dorianFlatTwo` (Phrygian ♮6), `lydianAugmented`, `lydianDominant`,
      `mixolydianFlatSix`, `locrianNaturalTwo`, `altered` (super-Locrian / diminished-whole-tone)
- [ ] Aliases: `phrygianNaturalSix`, `acoustic` (for lydian dominant), `aeolianDominant` (for
      mixolydian flat six), `superLocrian` (for altered), `diminishedWholeTone`
- [ ] Each entry has correct interval pattern and degree numbers
- [ ] `Scale.mode(mode)` extended to recognize melodic-minor mode names
- [ ] `isMelodicMinorModeFamily(type)` predicate (paralleling `isDiatonicModeFamily`)
- [ ] Tests verify the altered scale matches the standard 1 ♭2 ♭3 ♭4 ♭5 ♭6 ♭7 spelling
- [ ] Tests verify all six modes share pitch classes with melodic minor

### 2.3 Modes of harmonic minor

No dependencies. Catalog extension.

- [ ] Add to `SCALES`: `locrianNaturalSix`, `ionianSharpFive`, `dorianSharpFour` (Romanian /
      Ukrainian Dorian), `phrygianDominant`, `lydianSharpTwo`, `superLocrianFlatSeven` (alternate
      name `ultraLocrian`)
- [ ] Aliases: `freygish`, `spanishGypsy`, `spanishPhrygian` for phrygianDominant
- [ ] Same shape requirements as 2.2
- [ ] `isHarmonicMinorModeFamily(type)` predicate
- [ ] Tests verify each mode contains the correct interval pattern
- [ ] Tests verify pitch-class equivalence with parent harmonic minor

### 2.4 Harmonic major and its modes

No dependencies. Catalog extension.

- [ ] Add `harmonicMajor` (1 2 3 4 5 ♭6 7) and its six modes
- [ ] Mode names: `dorianFlatFive`, `phrygianFlatFour`, `lydianFlatThree`, `mixolydianFlatTwo`,
      `lydianAugmentedSharpTwo`, `locrianDoubleFlatSeven`
- [ ] `isHarmonicMajorModeFamily(type)` predicate
- [ ] Tests verify pitch-class equivalence

### 2.5 Bebop scales

No dependencies. Catalog extension.

- [ ] Add `bebopDominant` (mixolydian + ♮7 passing tone)
- [ ] Add `bebopMajor` (major + ♯5 passing tone)
- [ ] Add `bebopMinor` (Dorian + ♮3 passing tone)
- [ ] Add `bebopMelodicMinor` (melodic minor + ♭6 passing tone)
- [ ] Each entry is 8 notes, not 7 — catalog must support non-heptatonic scales (verify the existing
      infrastructure handles this)
- [ ] Document the chromatic-passing-tone rationale in source comments

### 2.6 Exotic and historical scales

No dependencies. Catalog extension.

- [ ] Add `hungarianMinor` (1 2 ♭3 ♯4 5 ♭6 7) — also known as `gypsyMinor`
- [ ] Add `doubleHarmonic` (1 ♭2 3 4 5 ♭6 7) — also known as `byzantine`, `arabic`, `gypsyMajor`
- [ ] Add `neapolitanMajor` (1 ♭2 ♭3 4 5 6 7) and `neapolitanMinor` (1 ♭2 ♭3 4 5 ♭6 7)
- [ ] Add `enigmatic` (1 ♭2 3 ♯4 ♯5 ♯6 7)
- [ ] Add `persian` (1 ♭2 3 4 ♭5 ♭6 7)
- [ ] Add `inSen` and `hirajoshi` (Japanese pentatonic)
- [ ] Add `kumoi` (Japanese pentatonic variant)
- [ ] Aliases for non-English names where culturally appropriate
- [ ] Tests verify interval patterns

### 2.7 Messiaen modes of limited transposition

No dependencies. Catalog extension. Mode 1 (whole-tone) and Mode 2 (octatonic) already exist as
`wholeTone` and `diminished`.

- [ ] Add `messiaenMode3` (9 notes: 1 2 ♭3 3 ♯4 5 ♭6 6 7)
- [ ] Add `messiaenMode4` (8 notes: 1 ♭2 2 4 ♯4 5 ♭6 7)
- [ ] Add `messiaenMode5` (6 notes: 1 ♭2 4 ♯4 5 7)
- [ ] Add `messiaenMode6` (8 notes: 1 2 3 4 ♯4 ♯5 ♯6 7)
- [ ] Add `messiaenMode7` (10 notes: 1 ♭2 2 ♭3 4 ♯4 5 ♭6 6 7)
- [ ] Aliases on existing entries: `messiaenMode1` for `wholeTone`, `messiaenMode2` for `diminished`
- [ ] Add `transpositions` field on each Messiaen mode entry indicating limited count (3 for mode 1,
      3 for mode 2, 4 for mode 3, 6 for modes 4–7)
- [ ] `isMessiaenMode(type)` predicate
- [ ] Tests verify each mode produces only the expected number of distinct transpositions

## Wave 2.B — Polychords and slash chords

### 2.8 Generalized slash chords

No dependencies. Refactor of existing behavior.

- [ ] `chord.slash(bass)` accepts arbitrary `Note` (not just chord tones)
- [ ] `Chord.fromSymbol('C/F#')` parses slash chords with non-chord-tone bass
- [ ] Existing chord-tone-bass slash chords continue to work identically
- [ ] `chord.bassIsChordTone` boolean property
- [ ] Documentation distinguishes "inversion slash" (bass is a chord tone) from "polychord slash"
      (bass is not)
- [ ] Tests cover both cases, including problematic ones like `C/F♯`, `Am/B`

### 2.9 Polychords

**Depends on:** 2.8

- [ ] `Polychord` value type composed of an upper chord and a lower chord
- [ ] `Polychord.create(upper, lower)` factory
- [ ] `polychord.notes` returns the union of both chords' pitches
- [ ] `polychord.symbol` renders using horizontal-line notation (`Cmaj7 / Gmaj7`) and falls back to
      slash notation when one structure is a single note
- [ ] `polychord.transpose(interval)` and related transposition methods
- [ ] Round-trip JSON serialization
- [ ] `Chord.isPolychord(value)` type guard
- [ ] Tests cover construction, transposition, and rendering

### 2.10 Upper-structure triads

**Depends on:** 2.9

- [ ] `Chord.upperStructure(triad, lowerChord)` constructor (sugar over `Polychord.create`)
- [ ] Catalog of named upper structures used in jazz pedagogy: "II/V7" (D triad over C7 = C13♯11),
      "♭II/V7" (D♭ over C7), "♭III/V7", "♯IV/V7", "VI/V7", "♭VI/V7", "♭VII/V7"
- [ ] `chord.upperStructureName()` reverse-lookup for an existing polychord
- [ ] Tests verify the standard naming for all canonical upper structures

## Wave 2.C — Harmonic context (Phase 1 dependent)

### 2.11 Modal mixture / borrowed chords

**Depends on:** 1.6 (Key), 1.7 (Roman numerals)

- [ ] `key.borrowedChord('bVI')` → returns the borrowed chord with mode-mixture metadata
- [ ] `key.isBorrowed(chord)` returns true for chords from the parallel mode
- [ ] `key.borrowedFrom(chord)` returns the source key when the chord is borrowed
- [ ] Roman numeral output marks borrowed chords (e.g., `♭VI`, `iv` in major)
- [ ] Catalog of common borrowed chords for major (`iv`, `♭VI`, `♭VII`, `♭III`, `vii°7`) and for
      minor (`IV`, `I`, `II`)
- [ ] Tests verify mode-mixture identification across major and minor keys

### 2.12 Secondary dominants and tonicization

**Depends on:** 1.6, 1.7

- [ ] `key.secondaryDominant('V/V')` → constructs the chord (in C major: V/V = D7)
- [ ] Supports `V/`, `V7/`, `vii°/`, `vii°7/` of any diatonic degree
- [ ] `key.identifyAsSecondaryDominant(chord)` returns `'V/V' | 'V7/ii' | ...` or `null`
- [ ] Roman numeral output uses standard slash notation (`V7/IV`, `vii°/V`)
- [ ] `key.tonicization(chord)` returns the temporary tonic (the chord being tonicized)
- [ ] Handles applied chords to all diatonic targets except non-tonicizable degrees (vii° in major)
- [ ] Tests cover all valid applied chord targets in major and minor keys

### 2.13 Voice leading core

**Depends on:** 1.6 (for Key context); other Phase-1 items not strictly required

- [ ] `voiceLeading(chordA, chordB, options?)` returns the smoothest voicing of `chordB` given
      `chordA`'s voicing, minimizing total semitone motion
- [ ] Algorithm respects common-tone retention, stepwise motion preference, and voice-count
      constraints
- [ ] `detectParallelFifths(voicingA, voicingB)`, `detectParallelOctaves(voicingA, voicingB)` return
      offending voice pairs
- [ ] `detectVoiceCrossing(voicing)` returns crossings within a single chord
- [ ] `detectOverlap(voicingA, voicingB)` returns voice overlaps between two chords
- [ ] `voiceLeadingCost(voicingA, voicingB)` returns total semitone motion (a sum across voices)
- [ ] Resolution rule helpers: `resolvesLeadingTone(voicingA, voicingB, key)`,
      `resolvesChordalSeventh(voicingA, voicingB)`
- [ ] Tests cover textbook voice-leading examples (I-IV-V-I, ii-V-I, deceptive cadence resolution)
- [ ] Tests verify parallel-motion detection on classic violations
- [ ] Documentation explains the algorithm and its limitations

### 2.14 Voice ranges (SATB)

**Depends on:** none structurally; pairs naturally with 2.13

- [ ] `VOICE_RANGES` catalog: `soprano: 'C4'-'A5'`, `alto: 'G3'-'D5'`, `tenor: 'C3'-'A4'`,
      `bass: 'E2'-'D4'` (use conservative academic ranges; document the source)
- [ ] Configurable: `customVoiceRange({ low, high, name })`
- [ ] `chord.voicedForSATB()` returns a four-voice arrangement respecting voice ranges
- [ ] `validateVoiceRanges(voicing, voiceAssignment)` returns violations
- [ ] `inRange(note, voice)` predicate
- [ ] Tests cover edge-of-range cases, range overlap detection, and SATB voicing of common chords

---

# Phase 3 — Compositional and Generative Tools

Tools for ear training, exercise generation, and compositional sketching. Most items here are
independent and can run in parallel once the relevant Phase-1/Phase-2 dependencies land.

## Wave 3.A — Independent generators

### 3.1 Random chord progression generator

**Depends on:** 1.6, 1.7, 1.8

- [ ] `randomChordProgression({ key, length, allowedFunctions?, mustEndWith?, rng? })`
- [ ] Constraint: progressions must follow harmonic-function syntax (T → P → D → T) unless
      overridden
- [ ] Optional bias toward common patterns (I-V-vi-IV, ii-V-I, blues progressions)
- [ ] Returns array of `{ chord, romanNumeral, function }`
- [ ] Seeded RNG support via injectable `RandomFunction` (matches existing `random.ts` pattern)
- [ ] `randomBluesProgression(key, options?)` convenience for 12-bar blues
- [ ] `randomJazzProgression(key, options?)` ii-V-I oriented
- [ ] Tests verify function-syntax constraints, length, and seed reproducibility

### 3.2 Random melody generator

**Depends on:** none structurally; benefits from 1.6

- [ ] `randomMelody({ scale, range, length, contour?, rhythm?, rng? })`
- [ ] `contour`: `'ascending' | 'descending' | 'arch' | 'inverted-arch' | 'random'`
- [ ] Voice-leading constraints: prefer stepwise motion, limit leaps, resolve tritones and sevenths
- [ ] Optional rhythm template (a sequence of durations or weights)
- [ ] Returns a sequence of `Note` (with optional duration metadata)
- [ ] Seeded RNG support
- [ ] Tests verify range adherence, scale-degree adherence, and contour shape

### 3.3 Random cadence generator

**Depends on:** 1.10 (cadence detection)

- [ ] `randomCadence({ key, type?, voicing?, rng? })`
- [ ] If `type` omitted, picks a random cadence type
- [ ] Returns the two chords plus the cadence label
- [ ] Optional SATB voicing if Phase 2 voice-leading is available
- [ ] Tests cover all cadence types

### 3.4 Ear-training quiz primitives

**Depends on:** 1.1, 1.6 for key-aware quizzes

- [ ] `quizInterval({ ascending?, descending?, harmonic?, intervals?, rng? })` returns
      `{ prompt: [Note, Note], answer: Interval }`
- [ ] `quizChordQuality({ qualities?, rng? })` returns `{ prompt: Chord, answer: ChordQuality }`
- [ ] `quizScale({ scales?, rng? })` returns `{ prompt: Scale, answer: ScaleType }`
- [ ] `quizCadence({ cadences?, key?, rng? })` returns
      `{ prompt: [Chord, Chord], answer: CadenceType }`
- [ ] `quizFunction({ key, rng? })` returns `{ prompt: Chord, answer: HarmonicFunction }`
- [ ] All quiz functions are pure and deterministic given a seed

## Wave 3.B — Harmonization and analysis

### 3.5 Melody harmonization

**Depends on:** 1.6, 2.13, 2.14

- [ ] `harmonize(melody, key, options?)` returns a chord progression supporting the melody
- [ ] Each melody note must be a chord tone or approved non-chord tone (passing/neighbor) of its
      chord
- [ ] Algorithm respects function syntax and voice-leading rules
- [ ] Configurable harmonic rhythm (chord changes per beat / per measure)
- [ ] Tests verify harmonization of simple melodies (e.g., "Twinkle Twinkle") in major and minor

### 3.6 Chord progression analysis

**Depends on:** 1.6, 1.7, 1.8, 1.10, 2.11, 2.12

- [ ] `analyzeProgression(chords, key)` returns array of
      `{ chord, romanNumeral, function, isBorrowed, isSecondaryDominant, cadence? }`
- [ ] Detects modulations (provide candidate keys when ambiguity is high)
- [ ] `analyzeProgression(chords)` (no key) attempts key detection
- [ ] Returns confidence scores when multiple keys plausibly fit
- [ ] Tests cover textbook progressions, ambiguous cases, and progressions with modulation

---

# Phase 4 — Post-Tonal, Microtonal, and Specialized

Each item in this phase is largely independent. They're grouped by topical proximity but can be
built in parallel.

## Wave 4.A — Pitch-class set theory

### 4.1 Pitch-class set core

No dependencies on Phase 1–3.

- [ ] `PitchClassSet.create(pitches)` accepting `Note[]`, `number[]` (0-11), or `ChromaticIndex[]`
- [ ] Properties: `pitches` (canonical 0-11 set), `cardinality`
- [ ] `pcs.transpose(n)`, `pcs.invert(axis?)` return new `PitchClassSet`
- [ ] `pcs.normalForm()`, `pcs.primeForm()` (Forte / Rahn algorithm — pick one and document)
- [ ] `pcs.intervalVector()` returns `[ic1, ic2, ic3, ic4, ic5, ic6]`
- [ ] `pcs.equals(other)`, `pcs.isTransposedFrom(other)`, `pcs.isInversionOf(other)`
- [ ] Round-trip JSON serialization
- [ ] Tests cover the Forte standard examples (set classes 3-1, 4-23, 6-Z44, etc.)

### 4.2 Forte numbers and set-class lookup

**Depends on:** 4.1

- [ ] `FORTE_NUMBERS` catalog mapping prime forms to Forte numbers (3-1 through 9-12)
- [ ] `pcs.forteNumber()` returns the Forte name (`'4-23'`)
- [ ] `pitchClassSetFromForte('4-23')` returns the prime-form set
- [ ] Z-relations marked correctly (sets sharing an interval vector but not related by Tn/TnI)
- [ ] Complement relationships (`pcs.complement()`)
- [ ] Tests verify all 222 set classes are represented and round-trip

### 4.3 Twelve-tone matrices

**Depends on:** 4.1

- [ ] `ToneRow.create(notes)` validating all 12 pitch classes are present exactly once
- [ ] `row.prime(n)`, `row.retrograde(n)`, `row.inversion(n)`, `row.retrogradeInversion(n)`
- [ ] `row.matrix()` returns the 12×12 matrix of all 48 forms
- [ ] `row.find(transformation)` searches the matrix
- [ ] Round-trip JSON
- [ ] Tests cover Schoenberg, Webern, and Berg row examples

## Wave 4.B — Tuning and temperament

### 4.4 Just intonation

No structural dependencies; coordinates with existing `Tuning` type.

- [ ] `JustIntonationTuning` extends `Tuning` with ratio-based intervals
- [ ] Catalog of 5-limit ratios for each scale degree (1/1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8, 2/1)
- [ ] 7-limit, 11-limit, 13-limit extensions documented in source comments
- [ ] `interval.justRatio()` returns the simplest just-intonation ratio for an interval
- [ ] `interval.cents(tuning)` returns the cent value under a given tuning
- [ ] `tuning.frequencyForNote(note, key?)` accounts for key-dependent intonation drift
- [ ] Tests verify wolf-fifth and comma-drift scenarios

### 4.5 Historical temperaments

**Depends on:** 4.4

- [ ] `MEANTONE_QUARTER_COMMA`, `WERCKMEISTER_III`, `KIRNBERGER_III`, `PYTHAGOREAN`,
      `EQUAL_TEMPERAMENT` as `Tuning` instances
- [ ] Each documents its historical context and the keys it favors
- [ ] `temperament.errorVsEqual(note, key)` returns the cent deviation from equal temperament
- [ ] Tests verify known characteristics (Pythagorean wolf at G♯/A♭, Werckmeister's "good keys")

### 4.6 Microtonal systems

**Depends on:** 4.4

- [ ] `EqualDivisionOfOctave(n)` constructor for n-EDO tuning systems
- [ ] Presets: `EDO_19`, `EDO_24` (quarter-tone), `EDO_31`, `EDO_53`, `EDO_72`
- [ ] `MicrotonalNote` extending `Note` with microtonal accidentals (♯, ♯/, ♯\\, etc., or cent
      offsets)
- [ ] Decision documented in source comments: how `Note` interoperates (separate type vs. extended
      `Note`)
- [ ] Quarter-tone accidental notation: `tQuartertoneSharp`, `tQuartertoneFlat`,
      `threeQuartertoneSharp`, `threeQuartertoneFlat`
- [ ] Tests verify cent values and round-trip serialization

## Wave 4.C — Practical extensions

### 4.7 Transposing instruments

No dependencies.

- [ ] `TRANSPOSING_INSTRUMENTS` catalog: B♭ clarinet, B♭ trumpet, A clarinet, E♭ alto sax, B♭ tenor
      sax, E♭ baritone sax, F horn, English horn, piccolo (8va), contrabass (8vb), guitar (8vb),
      etc.
- [ ] Each entry:
      `{ name, transposition: Interval, octaveShift: number, soundsLowerThanWritten: boolean }`
- [ ] `transposeForInstrument(note, instrument)` (concert pitch → written pitch)
- [ ] `transposeFromInstrument(note, instrument)` (written pitch → concert pitch)
- [ ] Tests verify a B♭ trumpet's written C sounds B♭, etc.

### 4.8 Clef-aware note ranges

**Depends on:** 2.14 (voice ranges) is helpful but not required

- [ ] `Clef` enum: `treble`, `bass`, `alto`, `tenor`, `soprano`, `mezzoSoprano`, `baritone`,
      `treble8va`, `treble8vb`, `bass8vb`
- [ ] `clef.middleLine` and `clef.lineNotes(['line1', 'line2', ...])` for staff-position math
- [ ] `note.staffPosition(clef)` returns the line/space position
- [ ] `noteAtStaffPosition(position, clef)` reverse lookup
- [ ] Tests cover all standard clefs

### 4.9 Open and spread voicings

**Depends on:** 2.13

- [ ] `chord.openVoicing()` returns a typical open voicing (1-3-5 spread across octaves)
- [ ] `chord.spreadVoicing(width)` controls the octave range of the voicing
- [ ] `chord.shellVoicing()` jazz convention: root, third, seventh
- [ ] `chord.guideToneVoicing(targetChord)` voice-leading-aware shell voicing
- [ ] `chord.rootlessVoicing()` removes the root for jazz piano left-hand
- [ ] Tests verify each voicing strategy's note set and ordering

### 4.10 Directed intervals

No dependencies.

- [ ] `DirectedInterval` value type wrapping `Interval` plus direction
- [ ] `note.directedIntervalTo(other)` returns ascending or descending
- [ ] `directedInterval.invert()` flips direction
- [ ] `directedInterval.absolute()` returns underlying `Interval`
- [ ] All existing `Note.distanceTo` etc. accept and return `DirectedInterval` where direction
      matters; existing API preserved as a non-directed shorthand
- [ ] Tests cover ascending, descending, unison, and octave cases

---

# Cross-cutting concerns (shipped alongside their phase)

These are not items in themselves — they are reminders that every phase ships with these covered.

## Documentation

- [ ] README updated with a section per major capability (key signatures, Roman numerals, voice
      leading, etc.)
- [ ] Each new public function has at least one usage example in its source-level docstring
- [ ] CHANGELOG entry per shipped item
- [ ] An `examples/` directory script demonstrating a non-trivial use case for each phase

## Testing

- [ ] 100% line coverage per `bunfig.toml` threshold
- [ ] Property-based tests (via `fast-check`) for round-trips: serialize/deserialize, parse/render,
      transform/invert
- [ ] Reference-corpus tests where possible (textbook examples for cadences, voice leading, set
      classes, twelve-tone rows)

## API stability

- [ ] No breaking changes to existing public API except where explicitly noted (e.g., `chord.slash`
      accepts non-chord-tone bass — this is purely additive)
- [ ] New exports are additive to `src/index.ts`
- [ ] Type-level changes preserve assignability for existing consumers

## Out of scope (intentional non-goals)

- **Full notation rendering.** Octavian provides the data; rendering (engraving, MIDI playback,
  audio synthesis) lives in downstream consumers.
- **Real-time audio.** No DSP, no synthesis, no audio buffer manipulation.
- **MusicXML / MIDI file I/O.** Could be a sister package; not part of core Octavian.
- **Genre-specific style models.** Algorithmic-composition heuristics beyond standard pedagogical
  rules are out of scope.
- **GUI / interactive components.** Library only.

---

# Suggested execution order at a glance

```
Phase 1
  Wave 1.A (parallel): 1.1, 1.2, 1.3, 1.4
  Wave 1.B (after 1.A): 1.5 → 1.6
  Wave 1.C (after 1.6): 1.7, 1.8, 1.9 (parallel) → 1.10

Phase 2
  Wave 2.A (parallel, no deps on Phase 1): 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
  Wave 2.B (parallel): 2.8 → 2.9 → 2.10
  Wave 2.C (after Phase 1): 2.11, 2.12, 2.13, 2.14 (largely parallel)

Phase 3
  Wave 3.A (after Phase 1): 3.1, 3.2, 3.3, 3.4 (parallel)
  Wave 3.B (after Phase 2): 3.5, 3.6 (parallel)

Phase 4
  Wave 4.A: 4.1 → 4.2, 4.3 (parallel after 4.1)
  Wave 4.B: 4.4 → 4.5, 4.6 (parallel after 4.4)
  Wave 4.C: 4.7, 4.8, 4.9, 4.10 (parallel)
```

At peak parallelism, an organized team or set of agents can have **7+ items in flight
simultaneously** (e.g., all of Wave 2.A plus Wave 1.B/1.C in progress).
