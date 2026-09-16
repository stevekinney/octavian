import { Note } from './note.js';
import type { NoteLike } from './note.js';
import { isNoteName } from './music-utilities.js';
import type { Accidental, Natural, NoteName } from './note-spellings.js';
import {
  ACCIDENTALS,
  ACCIDENTAL_OFFSETS,
  accidentalFromNoteName,
  buildNoteName,
  naturalFromNoteName,
} from './note-spellings.js';

/**
 * A note-naming convention system.
 *
 * - `'english'` — Standard English names: C, D, E, F, G, A, B with `#`/`b` accidentals.
 *   This is the default used everywhere else in this library.
 * - `'german'` — German convention: B-natural is written `H`, B-flat is written `B`.
 *   All other letters and accidentals follow the English convention.
 *   Full German `-is`/`-es` suffixes are not implemented; only the `H`/`B` swap.
 * - `'fixedDo'` — Romance-language fixed-do solfège names for the natural letters:
 *   C→Do, D→Re, E→Mi, F→Fa, G→Sol, A→La, B→Si. Accidentals are appended as-is
 *   (`Do#` for C#, `Reb` for Db). See `solfege.ts` for full chromatic syllable support.
 * - `'northernEuropean'` — Scandinavian/Northern European convention: B-natural is `H`
 *   (same as German) but B-flat is `Hb` rather than the German bare `B`. All other
 *   letters and accidentals follow English. This reflects the most common Scandinavian
 *   practice; note that actual usage varies by country and publication.
 */
export type NoteNamingSystem = 'english' | 'german' | 'fixedDo' | 'northernEuropean';

// ---------------------------------------------------------------------------
// Fixed-do label maps
// ---------------------------------------------------------------------------

const NATURAL_TO_FIXED_DO: Record<Natural, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
} satisfies Record<Natural, string>;

const FIXED_DO_TO_NATURAL: Record<string, Natural> = {
  Do: 'C',
  Re: 'D',
  Mi: 'E',
  Fa: 'F',
  Sol: 'G',
  La: 'A',
  Si: 'B',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Formats a note name according to the given naming system.
 *
 * German: B-natural → `H`, B-flat → `B`, other B-with-accidental → `H` + accidental.
 * NorthernEuropean: B-natural → `H`, B-flat → `Hb`, other B-with-accidental → `H` + accidental.
 * FixedDo: natural letter replaced by its syllable (Do/Re/Mi/Fa/Sol/La/Si), accidental appended.
 * English: unchanged (C, D#, Bb, etc.).
 *
 * @param value The note to format.
 * @param system The naming convention to use.
 * @returns The formatted note label.
 */
export function formatNoteName(value: NoteLike, system: NoteNamingSystem): string {
  const note = Note.create(value);
  const natural = naturalFromNoteName(note.note);
  const accidental = accidentalFromNoteName(note.note);

  if (system === 'english') {
    return note.note;
  }

  if (system === 'german') {
    if (natural === 'B') {
      if (accidental === '') {
        return 'H';
      }
      if (accidental === 'b') {
        // B-flat → bare 'B' (the German convention)
        return 'B';
      }
      // All other B accidentals: B + accidental → H + accidental
      return `H${accidental}`;
    }
    return note.note;
  }

  if (system === 'northernEuropean') {
    if (natural === 'B') {
      // All B notes: replace the 'B' letter with 'H', keep the accidental
      return `H${accidental}`;
    }
    return note.note;
  }

  // fixedDo: replace natural letter with syllable, keep accidental
  const syllable = NATURAL_TO_FIXED_DO[natural];
  return `${syllable}${accidental}`;
}

/**
 * Parses a note-name label back to a {@link NoteName} according to the given
 * naming system.
 *
 * German: `H` → B-natural; `B` → B-flat; `H` + accidental → B + accidental.
 * NorthernEuropean: `H` → B-natural; `H` + accidental → B + accidental (so `Hb` = B-flat).
 * FixedDo: syllable prefix (Do/Re/Mi/Fa/Sol/La/Si) + optional accidental suffix.
 * English: parsed directly as a note name.
 *
 * @param label The label to parse.
 * @param system The naming convention the label uses.
 * @returns The corresponding `NoteName`.
 * @throws {TypeError} When the label cannot be recognized under the given system.
 */
export function parseNoteNameLabel(label: string, system: NoteNamingSystem): NoteName {
  if (system === 'english') {
    return parseEnglishLabel(label);
  }
  if (system === 'german') {
    return parseGermanLabel(label);
  }
  if (system === 'northernEuropean') {
    return parseNorthernEuropeanLabel(label);
  }
  return parseFixedDoLabel(label);
}

// ---------------------------------------------------------------------------
// Private parsing helpers
// ---------------------------------------------------------------------------

function parseEnglishLabel(label: string): NoteName {
  if (!isNoteName(label)) {
    throw new TypeError(`Unrecognized note label: "${label}".`);
  }
  return label;
}

function accidentalFromString(accStr: string): Accidental {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  if (!ACCIDENTALS.includes(accStr as Accidental)) {
    throw new TypeError(`Unrecognized accidental: "${accStr}".`);
  }
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return accStr as Accidental;
}

function parseGermanLabel(label: string): NoteName {
  if (label === 'H') {
    // H without accidental → B-natural
    return 'B';
  }
  if (label.startsWith('H')) {
    // H + accidental → B + accidental
    const accStr = label.slice(1);
    const acc = accidentalFromString(accStr);
    return buildNoteName('B', ACCIDENTAL_OFFSETS[acc]);
  }
  if (label === 'B') {
    // Bare B → B-flat in German
    return 'Bb';
  }
  // All other labels: parse as English
  return parseEnglishLabel(label);
}

function parseNorthernEuropeanLabel(label: string): NoteName {
  if (label === 'H') {
    // H without accidental → B-natural
    return 'B';
  }
  if (label.startsWith('H')) {
    // H + accidental → B + accidental (so Hb = B-flat)
    const accStr = label.slice(1);
    const acc = accidentalFromString(accStr);
    return buildNoteName('B', ACCIDENTAL_OFFSETS[acc]);
  }
  // All other labels (including bare B = B-natural in northern European): parse as English
  return parseEnglishLabel(label);
}

function parseFixedDoLabel(label: string): NoteName {
  // Try longest syllable first to avoid 'Re' matching 'Re' when 'Sol' would fail etc.
  const syllables = ['Sol', 'Do', 'Re', 'Mi', 'Fa', 'La', 'Si'] as const;
  for (const syllable of syllables) {
    if (label.startsWith(syllable)) {
      // All syllables in the array have entries in FIXED_DO_TO_NATURAL.
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      const natural = FIXED_DO_TO_NATURAL[syllable]!;
      const accStr = label.slice(syllable.length);
      const acc = accidentalFromString(accStr);
      return buildNoteName(natural, ACCIDENTAL_OFFSETS[acc]);
    }
  }
  throw new TypeError(`Unrecognized fixed-do label: "${label}".`);
}
