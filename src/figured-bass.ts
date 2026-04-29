// figured-bass.ts: figured-bass notation — parsing, rendering, and
// chord ↔ figure conversion. Figured bass is context-sensitive (the
// digits are scale-step intervals above the bass, computed against
// the prevailing key), so chord-resolution requires an explicit
// `Key`. There is intentionally no `Chord.fromFiguredBass` — use the
// free function {@link figuredBassToChord} instead.
//
// The pure inversion → figure mapping lives in
// `./figured-bass-figures.js` so that `chord.ts`'s `figuredBass()`
// delegator can use it without creating a static circular import
// through this module.

import { Chord } from './chord.js';
import {
  figuredBassForCardinality,
  figuredBassInversionForCardinality,
  type FiguredBass,
  type FiguredBassAccidental,
  type FiguredBassChordKind,
  type FiguredBassDigit,
  type FiguredBassFigure,
  type FiguredBassInversion,
  type FiguredBassInversionIndex,
} from './figured-bass-figures.js';
import type { Key } from './key.js';
import { Note, type NoteLike } from './note.js';

export type {
  FiguredBass,
  FiguredBassAccidental,
  FiguredBassDigit,
  FiguredBassFigure,
  FiguredBassInversion,
};

/**
 * Inputs accepted by {@link parseFiguredBass}: an inline string
 * (e.g., `'6/4'`, `'♭7'`) or a stacked array of figures or strings.
 */
export type FiguredBassLike = string | readonly (string | FiguredBassFigure)[];

const SHARP_CHARACTERS = new Set(['#', '♯']);
const FLAT_CHARACTERS = new Set(['b', '♭']);
const NATURAL_CHARACTERS = new Set(['n', '♮']);

/**
 * Parses a figured-bass annotation from a string or a mixed array
 * into a normalized {@link FiguredBass} stack.
 *
 * String forms accepted:
 * - `'6'`, `'6/4'`, `'4/2'` — standard inversion shorthands.
 * - `'♭7'`, `'#6'`, `'6♯'` — accidentals before or after the digit.
 * - Empty string `''` — root-position triad (the `5/3` figure that's
 *   always implicit; an empty stack is its canonical representation).
 *
 * Array forms accept any mix of `FiguredBassFigure` objects and
 * single-figure strings (`'6'`, `'♭7'`).
 *
 * @throws TypeError when a string component is not a valid figure.
 */
export function parseFiguredBass(input: FiguredBassLike): FiguredBass {
  if (typeof input === 'string') {
    return parseInlineFiguredBass(input);
  }
  return input.map((entry) => (typeof entry === 'string' ? parseSingleFigure(entry) : entry));
}

function parseInlineFiguredBass(input: string): FiguredBass {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return [];
  }
  return trimmed.split('/').map(parseSingleFigure);
}

function parseSingleFigure(rawFigure: string): FiguredBassFigure {
  const trimmed = rawFigure.trim();
  if (trimmed.length === 0) {
    throw new TypeError('Expected a figured-bass figure, received an empty string.');
  }

  let accidental: FiguredBassAccidental | undefined;
  let digitText = '';

  for (const character of trimmed) {
    const next = accidentalForCharacter(character);
    if (next !== null) {
      if (accidental !== undefined) {
        throw new TypeError(
          `Figured-bass figure ${trimmed} has multiple accidentals; at most one is permitted.`,
        );
      }
      accidental = next;
    } else if (/\d/.test(character)) {
      digitText += character;
    } else {
      throw new TypeError(`Unexpected character ${character} in figured-bass figure ${trimmed}.`);
    }
  }

  if (digitText.length === 0) {
    throw new TypeError(`Figured-bass figure ${trimmed} is missing its digit.`);
  }
  const digit = Number.parseInt(digitText, 10);
  if (!isFiguredBassDigit(digit)) {
    throw new TypeError(`Figured-bass figure digit ${digit} is out of range 1..9.`);
  }

  return accidental === undefined ? { digit } : { digit, accidental };
}

function accidentalForCharacter(character: string): FiguredBassAccidental | null {
  if (SHARP_CHARACTERS.has(character)) return 'sharp';
  if (FLAT_CHARACTERS.has(character)) return 'flat';
  if (NATURAL_CHARACTERS.has(character)) return 'natural';
  return null;
}

function isFiguredBassDigit(value: number): value is FiguredBassDigit {
  return Number.isInteger(value) && value >= 1 && value <= 9;
}

/**
 * Renders a {@link FiguredBass} stack into both display formats.
 *
 * - `stacked` — array of single-figure strings, top-to-bottom, suitable
 *   for vertical typesetting (`['6', '4']`).
 * - `inline` — slash-separated string for prose (`'6/4'`).
 *
 * Accidentals render Unicode by default (`♯`, `♭`, `♮`) and are placed
 * *before* the digit. This normalizes on the parser's canonical
 * input form so that
 * `formatFiguredBass(parseFiguredBass('♭7')).inline === '♭7'`
 * round-trips. (Aldwell & Schachter print flats after the digit for
 * typesetting reasons; consumers rendering for engraving should
 * post-process if they need the suffix-flat convention.)
 */
export function formatFiguredBass(figures: FiguredBass): {
  readonly stacked: readonly string[];
  readonly inline: string;
} {
  const stacked = figures.map(formatSingleFigure);
  return { stacked, inline: stacked.join('/') };
}

function formatSingleFigure(figure: FiguredBassFigure): string {
  const digit = String(figure.digit);
  if (figure.accidental === undefined) {
    return digit;
  }
  // All accidentals render before the digit so that
  // `formatFiguredBass(parseFiguredBass('♭7')).inline === '♭7'`
  // round-trips. (Aldwell & Schachter print flats after the digit
  // for typesetting reasons; this library normalizes on the
  // prefix form to match the canonical parser examples.)
  if (figure.accidental === 'sharp') return `♯${digit}`;
  if (figure.accidental === 'flat') return `♭${digit}`;
  if (figure.accidental === 'natural') return `♮${digit}`;
  // Defensive: the type system constrains `accidental` to the three
  // values above. If a future variant is added, this branch flags it
  // rather than silently rendering as natural.
  throw new TypeError(`Unknown figured-bass accidental ${String(figure.accidental as never)}.`);
}

/**
 * Returns the figured-bass figure stack that names `chord`'s current
 * inversion. The returned stack is the *short* common-practice form —
 * for a root-position triad it is the empty stack `[]`; for a
 * first-inversion triad it is `[{ digit: 6 }]`.
 *
 * @throws RangeError when `chord` is not a triad or seventh chord.
 */
export function figuredBassForChord(chord: Chord): FiguredBass {
  const { kind, inversion } = chordCardinality(chord);
  return figuredBassForCardinality(kind, inversion);
}

/**
 * Returns the figured-bass inversion shorthand (`'5/3'`, `'6'`,
 * `'6/4'`, `'7'`, `'6/5'`, `'4/3'`, `'4/2'`) for `chord`. Useful when
 * coordinating with Roman-numeral analysis (see
 * `RomanNumeralInversion` in `./roman-numeral.js`).
 */
export function figuredBassInversionFor(chord: Chord): FiguredBassInversion {
  const { kind, inversion } = chordCardinality(chord);
  return figuredBassInversionForCardinality(kind, inversion);
}

function chordCardinality(chord: Chord): {
  readonly kind: FiguredBassChordKind;
  readonly inversion: FiguredBassInversionIndex;
} {
  const noteCount = chord.intervals.length;
  const inversion = chord.inversionIndex;
  // `Chord.inversion` rejects `inversion >= notes.length` at
  // construction, so for a 3-note chord the index is 0..2 and for a
  // 4-note chord the index is 0..3 — always within
  // `FiguredBassInversionIndex`.
  if (noteCount === 3 && (inversion === 0 || inversion === 1 || inversion === 2)) {
    return { kind: 'triad', inversion };
  }
  if (
    noteCount === 4 &&
    (inversion === 0 || inversion === 1 || inversion === 2 || inversion === 3)
  ) {
    return { kind: 'seventh', inversion };
  }
  throw new RangeError(
    `Figured-bass figures are defined for triads and seventh chords; received ${noteCount} notes.`,
  );
}

/**
 * Resolves a figured-bass annotation against `key` to a {@link Chord}.
 *
 * Figured bass is context-sensitive: the digits name scale-step
 * intervals above `bass` within the prevailing key, so the same
 * `(bass, figures)` pair resolves to different chords in different
 * keys. The returned chord is in the inversion that places `bass` at
 * the bottom, transposed so its bass note matches the requested
 * `bass` exactly (octave included).
 *
 * Recognized inversion patterns (in addition to the empty stack which
 * is the implicit root-position triad):
 *
 * - `'6'` → first-inversion triad
 * - `'6/4'` → second-inversion triad
 * - `'7'` → root-position seventh
 * - `'6/5'` → first-inversion seventh
 * - `'4/3'` → second-inversion seventh
 * - `'4/2'` → third-inversion seventh
 *
 * Accidentals on figures are accepted by the parser but are not yet
 * applied to chord resolution; pinned for a follow-up roadmap item
 * (see notation specs §1.9). For now, an accidental on any figure
 * causes this function to throw.
 *
 * @throws TypeError when the figure pattern doesn't name a standard
 *         inversion or when an accidental is present (deferred), and
 *         when no diatonic chord in `key` matches the requested bass.
 */
export function figuredBassToChord(bass: NoteLike, figures: FiguredBassLike, key: Key): Chord {
  const parsed = parseFiguredBass(figures);
  for (const figure of parsed) {
    if (figure.accidental !== undefined) {
      throw new TypeError(
        'Accidentals on figured-bass figures are not yet implemented; planned for a future roadmap item.',
      );
    }
  }
  const bassNote = Note.create(bass);
  const inversion = inversionShorthandForFigures(parsed);
  const cardinality = inversion === '5/3' || inversion === '6' || inversion === '6/4' ? 3 : 4;
  return resolveChordForBass(bassNote, key, inversion, cardinality);
}

// Both the empty stack (the implicit `5/3`) and the explicit `5/3`
// digit pair name root-position triads. Parsers that round-trip
// `'5/3'` through `parseFiguredBass` need the explicit form to
// resolve too, not only the empty stack.
const INVERSION_BY_DIGIT_KEY: Readonly<Record<string, FiguredBassInversion>> = {
  '': '5/3',
  '5,3': '5/3',
  '6': '6',
  '7': '7',
  '6,4': '6/4',
  '6,5': '6/5',
  '4,3': '4/3',
  '4,2': '4/2',
};

function inversionShorthandForFigures(figures: FiguredBass): FiguredBassInversion {
  const key = figures.map((figure) => figure.digit).join(',');
  const inversion = INVERSION_BY_DIGIT_KEY[key];
  if (inversion === undefined) {
    throw new TypeError(
      `Figured-bass stack ${key.replaceAll(',', '/')} doesn't name a standard inversion (5/3, 6, 6/4, 7, 6/5, 4/3, 4/2).`,
    );
  }
  return inversion;
}

function resolveChordForBass(
  bass: Note,
  key: Key,
  inversion: FiguredBassInversion,
  cardinality: 3 | 4,
): Chord {
  const candidates = cardinality === 3 ? key.diatonicChords() : key.diatonicSeventhChords();
  const inversionIndex = inversionIndexFor(inversion);
  const bassPitchClass = bassPitchClassOf(bass);
  for (const candidate of candidates) {
    const inverted = candidate.inversion(inversionIndex);
    if (bassPitchClassOf(inverted.bass) === bassPitchClass) {
      // Match by pitch class, then transpose to the caller's exact
      // octave so the returned chord's bass equals the requested
      // bass note rather than the diatonic-default register.
      const octaveOffset = bassOctaveOffset(bass, inverted.bass);
      return octaveOffset === 0 ? inverted : inverted.transposeBy(octaveOffset * 12);
    }
  }
  throw new TypeError(
    `No diatonic ${cardinality === 3 ? 'triad' : 'seventh chord'} in ${key.toString()} has ${bass.toString()} at the ${ordinalForInversion(inversion)} position.`,
  );
}

function bassPitchClassOf(note: Note): number {
  return Number(note.midi) % 12;
}

function bassOctaveOffset(requested: Note, found: Note): number {
  const requestedMidi = Number(requested.midi);
  const foundMidi = Number(found.midi);
  return Math.round((requestedMidi - foundMidi) / 12);
}

function inversionIndexFor(inversion: FiguredBassInversion): 0 | 1 | 2 | 3 {
  switch (inversion) {
    case '5/3':
    case '7':
      return 0;
    case '6':
    case '6/5':
      return 1;
    case '6/4':
    case '4/3':
      return 2;
    case '4/2':
      return 3;
  }
}

function ordinalForInversion(inversion: FiguredBassInversion): string {
  switch (inversion) {
    case '5/3':
    case '7':
      return 'root';
    case '6':
    case '6/5':
      return 'first-inversion';
    case '6/4':
    case '4/3':
      return 'second-inversion';
    case '4/2':
      return 'third-inversion';
  }
}
