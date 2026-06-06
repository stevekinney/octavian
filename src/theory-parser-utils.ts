import {
  CHORD_SYMBOLS,
  resolveChordSuffix,
  type CanonicalChordSuffix,
  type ChordSymbol,
} from './chords.js';
import { isNoteName } from './music-utilities.js';
import type { NoteName } from './note-spellings.js';
import { SCALES, resolveScaleType, type ScaleType } from './scales.js';
import type { KeySignatureMode } from './key-signature-catalog.js';

const KNOWN_SCALE_TYPES = new Set<string>(Object.keys(SCALES));

function isKnownScaleType(value: string): value is ScaleType {
  return KNOWN_SCALE_TYPES.has(value);
}

// ---------------------------------------------------------------------------
// Chord symbol lookup sorted longest-first so that prefix-match greediness
// never produces a short match when a longer symbol applies (e.g. 'mMaj7'
// must not match 'm' first).
// ---------------------------------------------------------------------------

const CHORD_SYMBOLS_BY_LENGTH: readonly ChordSymbol[] = [...CHORD_SYMBOLS].toSorted(
  (a, b) => b.length - a.length,
);

// ---------------------------------------------------------------------------
// Root extraction
// ---------------------------------------------------------------------------

/**
 * Attempts to read the leading note name (e.g. `Bb`, `F#`, `C`) from a
 * string and returns the note name plus the remainder, or `null` when the
 * string does not begin with a valid note name.
 *
 * @param input The string to inspect.
 * @returns The extracted root and remainder, or `null`.
 */
export function splitLeadingRoot(
  input: string,
): { readonly root: NoteName; readonly rest: string } | null {
  const letter = input[0];
  if (!letter || !/^[A-G]$/u.test(letter)) {
    return null;
  }

  // Try longest accidentals first to avoid prefix greediness.
  const accidentals = ['###', 'bbb', '##', 'bb', '#', 'b'] as const;
  for (const acc of accidentals) {
    const candidate = `${letter}${acc}`;
    if (input.startsWith(candidate) && isNoteName(candidate)) {
      return { root: candidate, rest: input.slice(candidate.length) };
    }
  }

  // All A–G letters are valid note names.
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return { root: letter as NoteName, rest: input.slice(1) };
}

// ---------------------------------------------------------------------------
// Chord symbol matching
// ---------------------------------------------------------------------------

/**
 * Attempts to match a chord symbol prefix at the start of a string.
 * Returns the matched symbol and the remaining string, or `null` when the
 * string does not begin with any recognized symbol (the empty-string case
 * corresponds to a major triad or slash-only input).
 *
 * @param input The string to inspect.
 * @returns The matched symbol and remainder, or `null`.
 */
function matchChordSymbol(
  input: string,
): { readonly symbol: ChordSymbol; readonly rest: string } | null {
  // Empty or slash-only → major triad (empty symbol).
  if (input === '' || input.startsWith('/')) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return { symbol: '' as ChordSymbol, rest: input };
  }

  for (const symbol of CHORD_SYMBOLS_BY_LENGTH) {
    if (symbol !== '' && input.startsWith(symbol)) {
      return { symbol, rest: input.slice(symbol.length) };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Parsed chord parts
// ---------------------------------------------------------------------------

/**
 * The result of parsing a chord name into its structural parts.
 */
export type ParsedChordParts = {
  readonly root: NoteName;
  readonly suffix: CanonicalChordSuffix;
  readonly symbol: ChordSymbol;
  readonly bass: NoteName | null;
};

function parseBassNote(bassString: string, context: string): NoteName {
  const bassResult = splitLeadingRoot(bassString.trim());
  if (!bassResult || bassResult.rest !== '' || !isNoteName(bassResult.root)) {
    throw new TypeError(`Unsupported bass note in slash chord: "${bassString}". ${context}`);
  }
  return bassResult.root;
}

/**
 * Parses a chord name string into its structural parts without constructing
 * any class instances. Throws {@link TypeError} for invalid input.
 *
 * The symbol is matched greedily (longest match first) before any slash-bass
 * splitting, so `"C6/9"` correctly matches the `6/9` symbol rather than
 * treating it as a `6` chord with bass `9`.
 *
 * @param name The chord name string to parse.
 * @returns The parsed chord parts.
 * @throws {TypeError} When the root, suffix, or slash bass note is unrecognized.
 */
export function parseChordParts(name: string): ParsedChordParts {
  const trimmed = name.trim();
  const rootResult = splitLeadingRoot(trimmed);
  if (!rootResult) {
    throw new TypeError(`Unsupported chord name: ${trimmed}. Could not determine root note.`);
  }

  const { root, rest } = rootResult;

  // Match the chord symbol greedily against the full remainder first.
  // This ensures that symbols containing '/' (i.e. '6/9') are not split
  // prematurely. The remaining string after the symbol is the slash-bass part.
  const symbolMatch = matchChordSymbol(rest);
  if (symbolMatch === null) {
    throw new TypeError(`Unsupported chord suffix or symbol: ${rest}. In chord name "${trimmed}".`);
  }

  const afterSymbol = symbolMatch.rest;
  let bassString: string | null = null;

  if (afterSymbol !== '') {
    if (!afterSymbol.startsWith('/')) {
      throw new TypeError(
        `Unsupported chord suffix or symbol: ${rest}. In chord name "${trimmed}".`,
      );
    }
    bassString = afterSymbol.slice(1);
  }

  // symbolMatch.symbol always comes from CHORD_SYMBOLS, so resolveChordSuffix
  // will always succeed here without a try/catch.
  const suffix: CanonicalChordSuffix = resolveChordSuffix(symbolMatch.symbol);

  const bass =
    bassString !== null ? parseBassNote(bassString, `In chord name "${trimmed}".`) : null;

  return { root, suffix, symbol: symbolMatch.symbol, bass };
}

// ---------------------------------------------------------------------------
// Parsed scale parts
// ---------------------------------------------------------------------------

const HUMAN_SCALE_NAME_MAP: Readonly<Record<string, ScaleType>> = {
  major: 'major',
  minor: 'naturalMinor',
  'natural minor': 'naturalMinor',
  'harmonic minor': 'harmonicMinor',
  'melodic minor': 'melodicMinor',
  dorian: 'dorian',
  phrygian: 'phrygian',
  lydian: 'lydian',
  mixolydian: 'mixolydian',
  locrian: 'locrian',
  'major pentatonic': 'majorPentatonic',
  'minor pentatonic': 'minorPentatonic',
  blues: 'blues',
  'minor blues': 'blues',
  chromatic: 'chromatic',
  'whole tone': 'wholeTone',
  'whole-tone': 'wholeTone',
  diminished: 'diminished',
  octatonic: 'diminished',
  'half-whole diminished': 'halfWholeDiminished',
  'half whole diminished': 'halfWholeDiminished',
  ionian: 'major',
  aeolian: 'naturalMinor',
  pentatonic: 'majorPentatonic',
};

/**
 * Normalizes a scale type string from user input into a {@link ScaleType},
 * handling both camelCase canonical/alias names and space-separated human
 * names like `"melodic minor"` or `"natural minor"`.
 *
 * @param input The scale type string to normalize.
 * @returns The resolved ScaleType.
 * @throws {TypeError} When the input does not match any known scale type.
 */
export function normalizeScaleType(input: string): ScaleType {
  const trimmed = input.trim();

  // Check human-readable map first (case-insensitive, handles space-separated names).
  const lower = trimmed.toLowerCase();
  const humanMapped = HUMAN_SCALE_NAME_MAP[lower];
  if (humanMapped !== undefined) {
    return resolveScaleType(humanMapped);
  }

  // Try direct camelCase canonical / alias match (isKnownScaleType narrows to ScaleType).
  if (isKnownScaleType(trimmed)) {
    return resolveScaleType(trimmed);
  }

  throw new TypeError(`Unsupported scale type: ${trimmed}.`);
}

/**
 * The result of parsing a scale name into its structural parts.
 */
export type ParsedScaleParts = {
  readonly root: NoteName;
  readonly type: ScaleType;
};

/**
 * Parses a scale name string into its structural parts without constructing
 * any class instances. Throws {@link TypeError} for invalid input.
 *
 * @param name The scale name string to parse.
 * @returns The parsed scale parts.
 * @throws {TypeError} When the root or scale type is unrecognized.
 */
export function parseScaleParts(name: string): ParsedScaleParts {
  const trimmed = name.trim();
  const rootResult = splitLeadingRoot(trimmed);
  if (!rootResult) {
    throw new TypeError(`Unsupported scale name: ${trimmed}. Could not determine root note.`);
  }

  const { root, rest } = rootResult;
  const typePart = rest.trim();
  if (typePart === '') {
    throw new TypeError(`Unsupported scale name: ${trimmed}. Missing scale type.`);
  }

  try {
    const type = normalizeScaleType(typePart);
    return { root, type };
  } catch {
    throw new TypeError(`Unsupported scale type: ${typePart}. In scale name "${trimmed}".`);
  }
}

// ---------------------------------------------------------------------------
// Parsed key parts
// ---------------------------------------------------------------------------

/**
 * The result of parsing a key name into its structural parts.
 */
export type ParsedKeyParts = {
  readonly root: NoteName;
  readonly mode: KeySignatureMode;
};

/**
 * Parses a key name string into its structural parts without constructing
 * any class instances. Throws {@link TypeError} for invalid input.
 *
 * @param name The key name string to parse.
 * @returns The parsed key parts.
 * @throws {TypeError} When the tonic or mode is unrecognized.
 */
export function parseKeyParts(name: string): ParsedKeyParts {
  const trimmed = name.trim();
  const rootResult = splitLeadingRoot(trimmed);
  if (!rootResult) {
    throw new TypeError(`Unsupported key name: ${trimmed}. Could not determine tonic.`);
  }

  const { root, rest } = rootResult;
  const modePart = rest.trim().toLowerCase();
  if (modePart !== 'major' && modePart !== 'minor') {
    throw new TypeError(
      `Unsupported key mode: "${rest.trim()}". Expected "major" or "minor". In key name "${trimmed}".`,
    );
  }

  return { root, mode: modePart };
}
