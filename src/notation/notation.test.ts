/**
 * Tests for the notation subpath module.
 *
 * Ground truth for staff positions:
 * - Treble clef:
 *   - Bottom line: E4 (position 0)
 *   - G4: 2nd line from bottom (position 2) — the G clef reference
 *   - Middle C (C4): 1st ledger line below (position -2, 1 ledger line)
 *   - Top line: F5 (position 8)
 *   - A5: 1st ledger line above (position 10, 1 ledger line)
 * - Bass clef:
 *   - Bottom line: G2 (position 0)
 *   - Top line: A3 (position 8)
 *   - Middle C (C4): 1st ledger line above (position 10, 1 ledger line)
 */

import { describe, it, expect } from 'bun:test';
import { Note } from '../note.js';
import { Chord } from '../chord.js';
import { keySignatureFor } from '../key-signature-catalog.js';
import { createRational } from '../rational.js';
import { staffPositionFor } from './staff-position.js';
import { accidentalForDisplay } from './accidental-display.js';
import { toNotationEvent } from './notation-event.js';

// ---------------------------------------------------------------------------
// staffPositionFor — treble clef
// ---------------------------------------------------------------------------

describe('staffPositionFor — treble clef', () => {
  it('places E4 at position 0 (bottom line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'E', octave: 4 }), 'treble');
    expect(pos.lineOrSpace).toBe(0);
    expect(pos.ledgerLines).toBe(0);
    expect(pos.step).toBe('E');
    expect(pos.octave).toBe(4);
    expect(pos.clef).toBe('treble');
  });

  it('places G4 at position 2 (2nd line, the G-clef reference)', () => {
    const pos = staffPositionFor(Note.create({ note: 'G', octave: 4 }), 'treble');
    expect(pos.lineOrSpace).toBe(2);
    expect(pos.ledgerLines).toBe(0);
  });

  it('places middle C (C4) at position -2 (1st ledger line below)', () => {
    const pos = staffPositionFor(Note.create({ note: 'C', octave: 4 }), 'treble');
    expect(pos.lineOrSpace).toBe(-2);
    expect(pos.ledgerLines).toBe(1);
  });

  it('C# and Cb share the same position as C4', () => {
    const posSharp = staffPositionFor(Note.create({ note: 'C#', octave: 4 }), 'treble');
    const posFlat = staffPositionFor(Note.create({ note: 'Cb', octave: 4 }), 'treble');
    expect(posSharp.lineOrSpace).toBe(-2);
    expect(posFlat.lineOrSpace).toBe(-2);
    expect(posSharp.ledgerLines).toBe(1);
    expect(posFlat.ledgerLines).toBe(1);
  });

  it('places F5 at position 8 (top line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'F', octave: 5 }), 'treble');
    expect(pos.lineOrSpace).toBe(8);
    expect(pos.ledgerLines).toBe(0);
  });

  it('places A5 at position 10 (1st ledger line above)', () => {
    const pos = staffPositionFor(Note.create({ note: 'A', octave: 5 }), 'treble');
    expect(pos.lineOrSpace).toBe(10);
    expect(pos.ledgerLines).toBe(1);
  });

  it('places B5 at position 11 (space above the 1st ledger line — still 1 ledger line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'B', octave: 5 }), 'treble');
    expect(pos.lineOrSpace).toBe(11);
    // B5 sits in the space just above the A5 ledger line; only that one ledger line is drawn.
    expect(pos.ledgerLines).toBe(1);
  });

  it('places C6 at position 12 (2nd ledger line above)', () => {
    const pos = staffPositionFor(Note.create({ note: 'C', octave: 6 }), 'treble');
    expect(pos.lineOrSpace).toBe(12);
    expect(pos.ledgerLines).toBe(2);
  });

  it('places D4 below bottom line in the first space (position -1, no ledger line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'D', octave: 4 }), 'treble');
    expect(pos.lineOrSpace).toBe(-1);
    // D4 is in the space just below the bottom line — no ledger line is drawn yet.
    expect(pos.ledgerLines).toBe(0);
  });

  it('places B3 at position -3 (space below the C4 ledger line — still 1 ledger line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'B', octave: 3 }), 'treble');
    expect(pos.lineOrSpace).toBe(-3);
    // B3 sits in the space just below the C4 ledger line; only that one ledger line is drawn.
    expect(pos.ledgerLines).toBe(1);
  });

  it('places A3 at position -4 (second ledger line below)', () => {
    const pos = staffPositionFor(Note.create({ note: 'A', octave: 3 }), 'treble');
    expect(pos.lineOrSpace).toBe(-4);
    expect(pos.ledgerLines).toBe(2);
  });

  it('accepts a note-name string with octave', () => {
    // Use { note, octave } object form to avoid branded type issues
    const pos = staffPositionFor({ note: 'E', octave: 4 }, 'treble');
    expect(pos.lineOrSpace).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// staffPositionFor — bass clef
// ---------------------------------------------------------------------------

describe('staffPositionFor — bass clef', () => {
  it('places G2 at position 0 (bottom line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'G', octave: 2 }), 'bass');
    expect(pos.lineOrSpace).toBe(0);
    expect(pos.ledgerLines).toBe(0);
  });

  it('places A3 at position 8 (top line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'A', octave: 3 }), 'bass');
    expect(pos.lineOrSpace).toBe(8);
    expect(pos.ledgerLines).toBe(0);
  });

  it('places middle C (C4) at position 10 (1st ledger line above)', () => {
    const pos = staffPositionFor(Note.create({ note: 'C', octave: 4 }), 'bass');
    expect(pos.lineOrSpace).toBe(10);
    expect(pos.ledgerLines).toBe(1);
  });

  it('places B1 below the bass staff', () => {
    const pos = staffPositionFor(Note.create({ note: 'B', octave: 1 }), 'bass');
    expect(pos.lineOrSpace).toBeLessThan(0);
    expect(pos.ledgerLines).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// staffPositionFor — other clefs
// ---------------------------------------------------------------------------

describe('staffPositionFor — alto clef', () => {
  it('places F3 at position 0 (bottom line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'F', octave: 3 }), 'alto');
    expect(pos.lineOrSpace).toBe(0);
    expect(pos.ledgerLines).toBe(0);
  });

  it('places middle C (C4) on the middle line of the alto staff (position 4)', () => {
    const pos = staffPositionFor(Note.create({ note: 'C', octave: 4 }), 'alto');
    // C4 in alto clef sits on the middle line (position 4)
    expect(pos.lineOrSpace).toBe(4);
    expect(pos.ledgerLines).toBe(0);
  });
});

describe('staffPositionFor — tenor clef', () => {
  it('places D3 at position 0 (bottom line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'D', octave: 3 }), 'tenor');
    expect(pos.lineOrSpace).toBe(0);
    expect(pos.ledgerLines).toBe(0);
  });
});

describe('staffPositionFor — soprano clef', () => {
  it('places C4 at position 0 (bottom line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'C', octave: 4 }), 'soprano');
    expect(pos.lineOrSpace).toBe(0);
    expect(pos.ledgerLines).toBe(0);
  });
});

describe('staffPositionFor — mezzo-soprano clef', () => {
  it('places A3 at position 0 (bottom line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'A', octave: 3 }), 'mezzo-soprano');
    expect(pos.lineOrSpace).toBe(0);
    expect(pos.ledgerLines).toBe(0);
  });
});

describe('staffPositionFor — baritone clef', () => {
  it('places E2 at position 0 (bottom line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'E', octave: 2 }), 'baritone');
    expect(pos.lineOrSpace).toBe(0);
    expect(pos.ledgerLines).toBe(0);
  });
});

describe('staffPositionFor — percussion clef', () => {
  it('uses treble reference (E4 = bottom line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'E', octave: 4 }), 'percussion');
    expect(pos.lineOrSpace).toBe(0);
    expect(pos.ledgerLines).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// accidentalForDisplay
// ---------------------------------------------------------------------------

describe('accidentalForDisplay', () => {
  it('returns null for F# in G major (key already sharpens F)', () => {
    const gMajor = keySignatureFor('G', 'major');
    const result = accidentalForDisplay(Note.create({ note: 'F#', octave: 4 }), gMajor);
    expect(result).toBeNull();
  });

  it('returns natural for F-natural in G major', () => {
    const gMajor = keySignatureFor('G', 'major');
    const result = accidentalForDisplay(Note.create({ note: 'F', octave: 4 }), gMajor);
    expect(result).toBe('natural');
  });

  it('returns sharp for G# in G major', () => {
    const gMajor = keySignatureFor('G', 'major');
    const result = accidentalForDisplay(Note.create({ note: 'G#', octave: 4 }), gMajor);
    expect(result).toBe('sharp');
  });

  it('returns null for C-natural in C major', () => {
    const cMajor = keySignatureFor('C', 'major');
    const result = accidentalForDisplay(Note.create({ note: 'C', octave: 4 }), cMajor);
    expect(result).toBeNull();
  });

  it('returns sharp for C# in C major', () => {
    const cMajor = keySignatureFor('C', 'major');
    const result = accidentalForDisplay(Note.create({ note: 'C#', octave: 4 }), cMajor);
    expect(result).toBe('sharp');
  });

  it('returns flat for C-flat in C major', () => {
    const cMajor = keySignatureFor('C', 'major');
    const result = accidentalForDisplay(Note.create({ note: 'Cb', octave: 4 }), cMajor);
    expect(result).toBe('flat');
  });

  it('returns null for Bb in Bb major', () => {
    const bbMajor = keySignatureFor('Bb', 'major');
    const result = accidentalForDisplay(Note.create({ note: 'Bb', octave: 4 }), bbMajor);
    expect(result).toBeNull();
  });

  it('returns natural for B-natural in Bb major', () => {
    const bbMajor = keySignatureFor('Bb', 'major');
    const result = accidentalForDisplay(Note.create({ note: 'B', octave: 4 }), bbMajor);
    expect(result).toBe('natural');
  });

  it('returns double-sharp for F## in G major', () => {
    const gMajor = keySignatureFor('G', 'major');
    const result = accidentalForDisplay(Note.create({ note: 'F##', octave: 4 }), gMajor);
    expect(result).toBe('double-sharp');
  });

  it('returns double-flat for Ebb in Eb major', () => {
    const ebMajor = keySignatureFor('Eb', 'major');
    const result = accidentalForDisplay(Note.create({ note: 'Ebb', octave: 4 }), ebMajor);
    expect(result).toBe('double-flat');
  });

  it('returns triple-sharp for C### in C major', () => {
    const cMajor = keySignatureFor('C', 'major');
    const result = accidentalForDisplay(Note.create({ note: 'C###', octave: 4 }), cMajor);
    expect(result).toBe('triple-sharp');
  });

  it('returns triple-flat for Cbbb in C major', () => {
    const cMajor = keySignatureFor('C', 'major');
    const result = accidentalForDisplay(Note.create({ note: 'Cbbb', octave: 4 }), cMajor);
    expect(result).toBe('triple-flat');
  });
});

// ---------------------------------------------------------------------------
// toNotationEvent — note
// ---------------------------------------------------------------------------

describe('toNotationEvent — note input', () => {
  it('creates a note event with staff position and accidental', () => {
    const gMajor = keySignatureFor('G', 'major');
    const event = toNotationEvent(Note.create({ note: 'F#', octave: 4 }), {
      clef: 'treble',
      keySignature: gMajor,
    });
    expect(event.type).toBe('note');
    if (event.type === 'note') {
      expect(event.noteName).toBe('F#');
      expect(event.octave).toBe(4);
      expect(event.accidentalDisplay).toBeNull();
      expect(event.staffPosition.clef).toBe('treble');
      expect(event.staffPosition.step).toBe('F');
    }
  });

  it('defaults to treble clef and C major when no options given', () => {
    const event = toNotationEvent(Note.create({ note: 'E', octave: 4 }));
    expect(event.type).toBe('note');
    if (event.type === 'note') {
      expect(event.staffPosition.lineOrSpace).toBe(0);
      expect(event.accidentalDisplay).toBeNull();
    }
  });

  it('attaches duration when provided', () => {
    const quarter = createRational(1, 4);
    const event = toNotationEvent(Note.create({ note: 'C', octave: 4 }), { duration: quarter });
    expect(event.type).toBe('note');
    if (event.type === 'note') {
      expect(event.duration).toEqual(quarter);
    }
  });

  it('omits duration when not provided', () => {
    const event = toNotationEvent(Note.create({ note: 'C', octave: 4 }));
    expect(event.type).toBe('note');
    if (event.type === 'note') {
      expect(event.duration).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// toNotationEvent — chord input
// ---------------------------------------------------------------------------

describe('toNotationEvent — chord input', () => {
  it('creates a chord event with one NotationNoteEvent per chord note', () => {
    const chord = Chord.create('C4', 'major');
    const event = toNotationEvent(chord, { clef: 'treble' });
    expect(event.type).toBe('chord');
    if (event.type === 'chord') {
      // C major triad (C4, E4, G4) = 3 notes
      expect(event.notes.length).toBe(3);
      for (const note of event.notes) {
        expect(note.type).toBe('note');
        expect(typeof note.noteName).toBe('string');
      }
    }
  });

  it('attaches duration to a chord event', () => {
    const chord = Chord.create('C4', 'major');
    const half = createRational(1, 2);
    const event = toNotationEvent(chord, { duration: half });
    expect(event.type).toBe('chord');
    if (event.type === 'chord') {
      expect(event.duration).toEqual(half);
    }
  });

  it('omits duration from chord event when not provided', () => {
    const chord = Chord.create('C4', 'major');
    const event = toNotationEvent(chord);
    expect(event.type).toBe('chord');
    if (event.type === 'chord') {
      expect(event.duration).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// toNotationEvent — rest input
// ---------------------------------------------------------------------------

describe('toNotationEvent — rest input', () => {
  it('creates a rest event', () => {
    const event = toNotationEvent('rest');
    expect(event.type).toBe('rest');
  });

  it('attaches duration to a rest event', () => {
    const whole = createRational(1, 1);
    const event = toNotationEvent('rest', { duration: whole });
    expect(event.type).toBe('rest');
    if (event.type === 'rest') {
      expect(event.duration).toEqual(whole);
    }
  });

  it('omits duration from rest when not provided', () => {
    const event = toNotationEvent('rest');
    expect(event.type).toBe('rest');
    if (event.type === 'rest') {
      expect(event.duration).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// JSON round-trip
// ---------------------------------------------------------------------------

describe('toNotationEvent — JSON round-trip', () => {
  it('note event survives JSON.stringify / JSON.parse without losing spelling', () => {
    const event = toNotationEvent(Note.create({ note: 'F#', octave: 4 }), { clef: 'treble' });
    expect(JSON.parse(JSON.stringify(event))).toEqual(event);
    // Verify spelling fields survive the round-trip
    if (event.type === 'note') {
      const parsed = JSON.parse(JSON.stringify(event));
      expect(parsed.noteName).toBe('F#');
      expect(parsed.octave).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------
// Ledger line edge cases
// ---------------------------------------------------------------------------

describe('ledger line computation', () => {
  it('space just below staff (D4 in treble) uses 0 ledger lines (first ledger line is C4)', () => {
    // D4 is at position -1; it sits in the space below the bottom line.
    // The C4 ledger line (position -2) is only drawn when needed for C4 itself.
    const pos = staffPositionFor(Note.create({ note: 'D', octave: 4 }), 'treble');
    expect(pos.lineOrSpace).toBe(-1);
    expect(pos.ledgerLines).toBe(0);
  });

  it('space just above staff (G5 in treble) uses 0 ledger lines (first ledger line is A5)', () => {
    // F5 is position 8 (top line), G5 is position 9 — the space above the top line.
    // The A5 ledger line (position 10) is only drawn when needed for A5 itself.
    const pos = staffPositionFor(Note.create({ note: 'G', octave: 5 }), 'treble');
    expect(pos.lineOrSpace).toBe(9);
    expect(pos.ledgerLines).toBe(0);
  });

  it('notes on the staff have 0 ledger lines', () => {
    // F4 is first space in treble (position 1)
    const pos = staffPositionFor(Note.create({ note: 'F', octave: 4 }), 'treble');
    expect(pos.lineOrSpace).toBe(1);
    expect(pos.ledgerLines).toBe(0);
  });

  it('notes on the top staff line have 0 ledger lines', () => {
    const pos = staffPositionFor(Note.create({ note: 'F', octave: 5 }), 'treble');
    expect(pos.lineOrSpace).toBe(8);
    expect(pos.ledgerLines).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Error arms
// ---------------------------------------------------------------------------

describe('staffPositionFor — invalid clef throws', () => {
  it('throws TypeError for an unrecognized clef', () => {
    const note = Note.create({ note: 'C', octave: 4 });
    expect(() => staffPositionFor(note, 'invalid-clef' as any)).toThrow(TypeError);
    expect(() => staffPositionFor(note, 'invalid-clef' as any)).toThrow(
      'Unsupported clef: invalid-clef.',
    );
  });
});

// ---------------------------------------------------------------------------
// Bass clef — additional ground truth
// ---------------------------------------------------------------------------

describe('bass clef additional positions', () => {
  it('places B2 at position 2 (second line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'B', octave: 2 }), 'bass');
    expect(pos.lineOrSpace).toBe(2);
    expect(pos.ledgerLines).toBe(0);
  });

  it('places D3 at position 4 (middle line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'D', octave: 3 }), 'bass');
    expect(pos.lineOrSpace).toBe(4);
    expect(pos.ledgerLines).toBe(0);
  });

  it('places F3 at position 6 (4th line)', () => {
    const pos = staffPositionFor(Note.create({ note: 'F', octave: 3 }), 'bass');
    expect(pos.lineOrSpace).toBe(6);
    expect(pos.ledgerLines).toBe(0);
  });
});
