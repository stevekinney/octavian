import { Chord } from './chord.js';
import type { ChordSuffix } from './chords.js';
import { Key } from './key.js';
import type { Note } from './note.js';
import {
  RomanNumeral,
  stripApplied,
  unsafeRomanNumeralFromParts,
  type RomanNumeralDegree,
  type RomanNumeralInversion,
  type RomanNumeralLike,
  type RomanNumeralQuality,
} from './roman-numeral.js';

/**
 * Builds a {@link Chord} from a Roman numeral within a tonal key context.
 *
 * Free function so `Key.chordFromRomanNumeral` can stay a thin
 * delegator. Caller passes the parent key and either a `RomanNumeral`
 * value or a string/snapshot accepted by {@link RomanNumeral.create}.
 */
export function chordFromRomanNumeral(key: Key, numeral: RomanNumeralLike): Chord {
  const rn = RomanNumeral.create(numeral);
  if (rn.isApplied) {
    // Applied chords (V/x, V7/x, vii°/x): the surface chord is generated
    // relative to the temporary tonic represented by the applied target.
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const target = rn.applied!;
    const targetTonicChord = buildChordFromNumeralInKey(key, target);
    const targetMode = qualityToMode(target.quality);
    const targetKey = Key.create(targetTonicChord.root.note, targetMode);
    return buildChordFromNumeralInKey(targetKey, stripApplied(rn));
  }
  return buildChordFromNumeralInKey(key, rn);
}

/**
 * Identifies the Roman numeral that best describes `chord` within `key`.
 *
 * Returns `null` when no diatonic match applies. Future items (modal
 * mixture in 2.11, secondary dominants in 2.12) extend the recognized
 * vocabulary to chromatic and applied chords.
 */
export function romanNumeralFor(key: Key, chord: Chord): RomanNumeral | null {
  return identifyRomanNumeral(key, chord);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function qualityToMode(quality: RomanNumeralQuality): 'major' | 'minor' {
  return quality === 'major' || quality === 'augmented' ? 'major' : 'minor';
}

function buildChordFromNumeralInKey(key: Key, rn: RomanNumeral): Chord {
  const tonic = chordTonicForNumeral(key, rn);
  const suffix = suffixForNumeral(rn);
  return Chord.create(tonic, suffix);
}

function chordTonicForNumeral(key: Key, rn: RomanNumeral): Note {
  const scaleNote = key.scale.degree(rn.degree);
  if (rn.alteration === undefined) {
    return scaleNote;
  }
  // Match the alteration's accidental family on respelling: ♭ → flat
  // preference, ♯ → sharp preference. Without this, transposeBy defaults
  // to sharp preference and produces A# from B♭ in C major.
  return rn.alteration === 'flat'
    ? scaleNote.transposeBy(-1, 'flats')
    : scaleNote.transposeBy(1, 'sharps');
}

const TRIAD_SUFFIX_BY_QUALITY: Readonly<Record<RomanNumeralQuality, ChordSuffix>> = {
  major: 'major',
  minor: 'minor',
  diminished: 'diminished',
  augmented: 'augmented',
};

const SEVENTH_SUFFIX_BY_QUALITY: Readonly<Record<RomanNumeralQuality, ChordSuffix>> = {
  // Diatonic vii°7 in major is half-diminished; full diminished sevenths
  // come from harmonic-minor or applied contexts and are recognized in
  // later roadmap items.
  major: 'majorSeventh',
  minor: 'minorSeventh',
  diminished: 'halfDiminishedSeventh',
  augmented: 'augmentedSeventh',
};

function suffixForNumeral(rn: RomanNumeral): ChordSuffix {
  const isTriad = rn.inversion === '5/3' || rn.inversion === '6' || rn.inversion === '6/4';
  if (isTriad) {
    return TRIAD_SUFFIX_BY_QUALITY[rn.quality];
  }
  // The dominant scale degree (V7) is the only major-quality numeral
  // that takes a true dominant-seventh shape; other major numerals get
  // major-seventh.
  if (rn.quality === 'major' && rn.degree === 5) {
    return 'dominantSeventh';
  }
  return SEVENTH_SUFFIX_BY_QUALITY[rn.quality];
}

const TRIAD_INVERSION_BY_INDEX: readonly RomanNumeralInversion[] = ['5/3', '6', '6/4'];
const SEVENTH_INVERSION_BY_INDEX: readonly RomanNumeralInversion[] = ['7', '6/5', '4/3', '4/2'];

function identifyRomanNumeral(key: Key, chord: Chord): RomanNumeral | null {
  const isSeventhChord = chord.size === 4;
  const candidates = isSeventhChord ? key.diatonicSeventhChords() : key.diatonicChords();
  for (let degreeIndex = 0; degreeIndex < candidates.length; degreeIndex++) {
    const candidate = candidates[degreeIndex];
    if (candidate === undefined) {
      continue;
    }
    if (candidate.root.note === chord.root.note && candidate.suffix === chord.suffix) {
      // Degree index 0..6 maps to RomanNumeralDegree 1..7.
      const degree = degreesByIndex[degreeIndex];
      if (degree === undefined) {
        continue;
      }
      return unsafeRomanNumeralFromParts(
        degree,
        qualityForChordSuffix(chord.suffix),
        inversionForChord(chord, isSeventhChord),
        undefined,
        undefined,
      );
    }
  }
  return null;
}

const degreesByIndex: readonly RomanNumeralDegree[] = [1, 2, 3, 4, 5, 6, 7];

const QUALITY_BY_SUFFIX: ReadonlyMap<ChordSuffix, RomanNumeralQuality> = new Map<
  ChordSuffix,
  RomanNumeralQuality
>([
  ['major', 'major'],
  ['majorSeventh', 'major'],
  ['dominantSeventh', 'major'],
  ['minor', 'minor'],
  ['minorSeventh', 'minor'],
  ['minorMajorSeventh', 'minor'],
  ['diminished', 'diminished'],
  ['diminishedSeventh', 'diminished'],
  ['halfDiminishedSeventh', 'diminished'],
  ['augmented', 'augmented'],
  ['augmentedSeventh', 'augmented'],
  ['augmentedMajorSeventh', 'augmented'],
]);

function qualityForChordSuffix(suffix: ChordSuffix): RomanNumeralQuality {
  // Unmapped suffixes (sus, add, extended) default to major as the
  // conservative choice for the v1 surface.
  return QUALITY_BY_SUFFIX.get(suffix) ?? 'major';
}

function inversionForChord(chord: Chord, isSeventh: boolean): RomanNumeralInversion {
  const table = isSeventh ? SEVENTH_INVERSION_BY_INDEX : TRIAD_INVERSION_BY_INDEX;
  const index = chord.inversionIndex;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  return table[index] ?? table[0]!;
}
