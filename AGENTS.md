# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, etc.) working in this repository.

## Essential Commands

### Development

```bash
bun run dev               # Start development with watch mode
bun run build             # Build for production (outputs to dist/)
bun ./dist/browser/index.js  # Run the browser-safe ESM build
node ./dist/browser/index.js # Run the browser-safe ESM build
```

### Testing

```bash
bun test                  # Run all tests
bun test src/utils        # Run tests in specific directory
bun test logger           # Run tests matching pattern
bun test --watch          # Watch mode
bun test --coverage       # Generate coverage report
```

### Code Quality

```bash
bun run lint             # Check linting errors
bun run lint:fix         # Auto-fix linting errors
bun run typecheck        # TypeScript type checking (src + scripts)
bun run typecheck:test   # TypeScript type checking (test files)
bun run format           # Format all files with Prettier
bun run format:check     # Check formatting without changes
bun run check            # Fast local sanity: format:check + lint + typecheck
bun run validate         # Full gate: format:check + lint + typecheck + typecheck:test + test + build + package:check
```

### Utilities

```bash
bun run clean            # Clean build artifacts (dist/, coverage/, caches)
bun run package:check    # Run publint + @arethetypeswrong/cli on packed tarball
```

## Architecture Overview

Octavian is a TypeScript music theory library. It has no runtime configuration, no environment
variables, and no `.env` file. Everything is pure logic over well-typed, catalog-driven data.

### Core Value Objects

All domain objects are immutable and frozen at construction time.

- **`Note`** (`src/note.ts`): An immutable musical note carrying its spelling (`NoteName`), octave
  (`Octave`), MIDI key (`MidiKey`), frequency (`Frequency`), and chromatic index (`ChromaticIndex`).
  Created via `new Note('C#', 4)` or the polymorphic `Note.create(value)` factory. Supports
  transposition, enharmonic comparison, interval distance calculation, and serialization via
  `toJSON()`.

- **`Chord`** (`src/chord.ts`): An immutable chord built from a root `Note` and a suffix/symbol
  string (e.g., `'maj7'`, `'majorSeventh'`). Created via `Chord.create('C4', 'maj7')` or
  `new Chord(note, suffix)`. Supports inversions, voicings, and serialization via `toJSON()` /
  `Chord.fromJSON()`.

- **`Scale`** (`src/scale.ts`): An immutable scale built from a root `Note` and a scale type (e.g.,
  `'major'`, `'dorian'`). Created via `Scale.create('C4', 'major')`. Supports mode derivation
  (`scale.mode('dorian')`), note membership checks, and adjacent-note navigation
  (`scale.next(note)`, `scale.previous(note)`).

### Branded Types for Domain Validation

`src/branded-types.ts` defines nominal types that prevent accidentally mixing up numeric domains:

- `MidiKey` — integer in `0..127`
- `Frequency` — positive number in hertz
- `Semitones` — integer semitone distance
- `Octave` — supported octave value (one of `-1..9`)
- `ChromaticIndex` — pitch-class index in `0..11`

Each branded type has a corresponding constructor (`createMidiKey`, `createFrequency`,
`createSemitones`, `createOctave`, `createChromaticIndex`) that validates the value and throws at
runtime if it is out of range.

### Catalog-Driven Data with Alias Resolution

Static catalogs live in dedicated files and drive all behavior. Alias resolution maps user-facing
shorthand to canonical names at the boundaries so that internal logic always operates on canonical
values.

- **`INTERVALS`** (`src/intervals.ts`): Keyed by canonical interval name (`'majorThird'`,
  `'minorSeventh'`, etc.). `resolveInterval(alias)` normalizes common aliases (e.g., `'M3'`, `'b7'`)
  to the canonical key.

- **`CHORDS`** (`src/chords.ts`): Keyed by canonical suffix (`'majorSeventh'`, `'minorSeventh'`,
  etc.). `resolveChordSuffix(alias)` accepts common shorthand (`'maj7'`, `'m7'`, chord symbols).
  `chordQualityForSuffix(suffix)` derives the quality string for display.

- **`SCALES`** (`src/scales.ts`): Keyed by canonical scale type (`'major'`, `'melodicMinor'`, etc.).
  `resolveScaleType(alias)` normalizes input. Mode families and diatonic mode derivation live here
  (`isDiatonicModeFamily`, `scaleTypeForMode`).

- **`STANDARD_TUNING`** (`src/tuning.ts`): A single `Tuning` object representing A4 = 440 Hz, used
  as the default reference for frequency calculations.

### Note Spellings and Music Utilities

- `src/note-spellings.ts`: Note name validation, enharmonic lookup, chromatic index mapping, and
  note name construction from a natural + accidental offset. Exports `ALL_NOTE_NAMES`, `NATURALS`,
  `ACCIDENTALS`, and helpers like `buildNoteName`, `enharmonicsForNoteName`,
  `noteNameToChromaticIndex`, `normalizeChromaticIndex`, `simplifyNoteName`.

- `src/music-utilities.ts`: Cross-cutting utilities—MIDI/frequency conversion (`noteNameToMidi`,
  `midiToFrequency`, `midiToNoteNameWithOctave`), type guards (`isNoteName`, `isNoteNameWithOctave`,
  `isInterval`, `isChordSuffix`, `isChordSymbol`, `isScaleType`), and note string parsing
  (`parseNoteName`, `parseNoteNameWithOctave`).

### Published Entry Point

`src/index.ts` is the single re-export barrel. Everything the library exposes to consumers is listed
there. There are no secondary entry points.

### Library Packaging

Build output targets both Node and Bun via `scripts/build.ts`:

- `dist/browser/index.js` — ESM bundle, `Bun.build target: 'browser'`, no external deps (zero
  runtime dependencies)
- `dist/index.d.ts` — shared TypeScript declarations

The `exports` map in `package.json` routes consumers automatically to the single browser-safe
bundle.

### Source Constraints

- `src/` must not use Bun-only runtime APIs (`Bun.file`, `Bun.env`, `Bun.serve`, etc.). Those belong
  in `scripts/` and test files only. Published code must be Node-compatible.
- No `@/*` path aliases—they leak into `.d.ts` files. Use relative imports everywhere, with `.js`
  extensions on all internal imports (required for ESM).
- No runtime configuration. No environment variables. No Zod schemas in `src/`.

### Git Hooks Architecture

Hooks are configured in `lefthook.yml` and implemented in `scripts/hooks/`:

- **pre-commit** (inline in `lefthook.yml`): formats staged files with Prettier, runs `oxlint --fix`
  on staged files, checks that `bun.lock` is staged when `package.json` changes.
- **pre-push**: runs `bun run validate` (the full gate).
- **post-checkout** (`scripts/hooks/post-checkout.ts`): installs deps when `package.json` +
  `bun.lock` changed between branches; surfaces config changes.
- **post-merge** (`scripts/hooks/post-merge.ts`): installs/cleans when deps or config changed;
  detects leftover conflict markers; shows merge statistics.

Hook utilities (`scripts/hooks/utilities.ts`) use `chalk` for color output and Bun's `$` shell tag
for subprocess calls.

## Testing Approach

- Tests use Bun's built-in runner (`bun:test`) with `describe`, `it`, `expect`.
- Test files are colocated with sources using the `.test.ts` suffix.
- `test/setup.ts` is preloaded via `bunfig.toml`—it resets mocks and system time in `afterEach`. All
  tests get this automatically.
- `tsconfig.test.json` provides relaxed TypeScript settings for test files.
- Coverage threshold is 100% for `src/`. Run `bun test --coverage` to verify.
- Oxlint rules are relaxed for test files (non-null assertions and `any` allowed).

## Adding New Features

1. Add new catalog entries to the relevant file (`intervals.ts`, `chords.ts`, `scales.ts`) following
   the existing pattern.
2. Add or extend value object methods on `Note`, `Chord`, or `Scale` as needed.
3. Export any new public names from `src/index.ts`.
4. Write colocated `.test.ts` coverage before opening a pull request.
5. Run `bun run validate` to confirm all gates pass.
