/**
 * Accidental display logic for notation rendering.
 *
 * Determines which accidental glyph (if any) a renderer must draw for a note
 * given the active key signature.  A `null` result means the key signature
 * already implies the note's correct spelling — no symbol is drawn.
 */

import { accidentalFromNoteName, naturalFromNoteName, type Accidental } from '../note-spellings.js';
import { Note, type NoteLike } from '../note.js';
import type { KeySignatureInformation } from '../key-signature-catalog.js';
import type { AccidentalDisplay } from './types.js';

// ---------------------------------------------------------------------------
// C-major (no accidentals) singleton — used as the default key signature
// ---------------------------------------------------------------------------

/**
 * The implied accidental for a natural note letter in the C-major key
 * (i.e., no accidentals on any letter).
 */
const C_MAJOR_ACCIDENTAL_SUFFIX = '' as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the accidental suffix that the key signature implies for the given
 * note letter, or `''` (natural) if the letter is not altered by the key.
 *
 * The key signature `accidentals` array contains entries like `'F#'`, `'Bb'`,
 * `'F##'`, etc. We extract the letter and compare.
 */
function keySignatureAccidentalFor(letter: string, keySignature: KeySignatureInformation): string {
  for (const keyNote of keySignature.accidentals) {
    if (keyNote.startsWith(letter)) {
      // Everything after the first character is the accidental suffix.
      return keyNote.slice(1);
    }
  }
  return C_MAJOR_ACCIDENTAL_SUFFIX;
}

/**
 * Maps an {@link Accidental} suffix to an {@link AccidentalDisplay} value.
 *
 * The parameter is typed as {@link Accidental} (the exhaustive union from
 * `note-spellings`), so the switch covers every possible value at compile
 * time — no `default` branch is needed or present. // exhaustive
 */
function accidentalSuffixToDisplay(suffix: Accidental): AccidentalDisplay {
  switch (suffix) {
    case '#':
      return 'sharp';
    case 'b':
      return 'flat';
    case '##':
      return 'double-sharp';
    case 'bb':
      return 'double-flat';
    case '###':
      return 'triple-sharp';
    case 'bbb':
      return 'triple-flat';
    case '':
      return 'natural';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the accidental glyph a renderer must draw for a note given the
 * active key signature, or `null` when no accidental is needed.
 *
 * Rules:
 * - When the note's accidental matches what the key signature implies for that
 *   letter, return `null` (the key signature already "covers" this note).
 * - When the note's accidental differs from what the key signature implies,
 *   return the display value for the note's actual accidental.
 * - A natural note in a key that sharpens (or flattens) that letter requires
 *   an explicit `'natural'` sign.
 *
 * @param note         - Any note-like value accepted by {@link Note.create}.
 * @param keySignature - The active key signature context.
 * @returns The accidental to display, or `null` if none is needed.
 */
export function accidentalForDisplay(
  note: NoteLike,
  keySignature: KeySignatureInformation,
): AccidentalDisplay | null {
  const resolved = Note.create(note);
  const letter = naturalFromNoteName(resolved.note);
  const noteAccidental = accidentalFromNoteName(resolved.note);
  const keyAccidental = keySignatureAccidentalFor(letter, keySignature);

  // If the note's actual accidental matches what the key signature implies,
  // no symbol is needed.
  if (noteAccidental === keyAccidental) {
    return null;
  }

  // The note deviates from the key signature — show the note's own accidental.
  return accidentalSuffixToDisplay(noteAccidental);
}
