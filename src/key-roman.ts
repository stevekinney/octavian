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
  const target = rn.applied;
  if (target === undefined) {
    return buildChordFromNumeralInKey(key, rn);
  }
  // Applied chords (V/x, V7/x, vii°/x): the surface chord is generated
  // relative to the temporary tonic represented by the applied target.
  // For nested applies (V/V/V), recursively resolve the target chord
  // through the same applied-chord path before constructing the
  // temporary key — otherwise V/V/V would build V of V (D) instead of
  // V of (V of V) which is V of D (A).
  const targetTonicChord = chordFromRomanNumeral(key, target);
  const targetMode = qualityToMode(target.quality);
  const targetKey = Key.create(targetTonicChord.root.note, targetMode);
  return buildChordFromNumeralInKey(targetKey, stripApplied(rn));
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
  const suffix = suffixForNumeral(rn, key);
  return Chord.create(tonic, suffix);
}

function chordTonicForNumeral(key: Key, rn: RomanNumeral): Note {
  const baseNote = baseScaleDegreeForNumeral(key, rn);
  if (rn.alteration === undefined) {
    return baseNote;
  }
  // Match the alteration's accidental family on respelling: ♭ → flat
  // preference, ♯ → sharp preference. Without this, transposeBy defaults
  // to sharp preference and produces A# from B♭ in C major.
  return rn.alteration === 'flat'
    ? baseNote.transposeBy(-1, 'flats')
    : baseNote.transposeBy(1, 'sharps');
}

/**
 * Resolves the scale degree for a Roman numeral, applying the
 * harmonic-minor leading-tone raise when the numeral acts as a dominant
 * function (V or vii°) on a minor key.
 *
 * In a minor key, the diatonic 7th degree is a whole step below the
 * tonic (B♭ in C minor). Standard tonal practice raises that 7th to a
 * leading tone (B♮) when the chord built on it acts as a dominant or
 * leading-tone chord — that's what "harmonic minor" means. This applies
 * to both v1's diatonic V/vii° in minor keys and to applied chords
 * tonicizing minor targets (`vii°/ii` in C major, `V/iv` in C minor).
 */
function baseScaleDegreeForNumeral(key: Key, rn: RomanNumeral): Note {
  const scaleNote = key.scale.degree(rn.degree);
  if (key.mode !== 'minor') {
    return scaleNote;
  }
  if (rn.degree === 7 && rn.quality === 'diminished') {
    // vii° in minor: raise degree 7 to the leading tone.
    return scaleNote.transposeBy(1, 'sharps');
  }
  if (rn.degree === 5 && rn.quality === 'major') {
    // V in minor: dominant chord requires the leading tone in its third,
    // but the chord *root* (degree 5) is unchanged — natural and
    // harmonic minor share scale degree 5. Return the diatonic note;
    // the major-quality suffix handles the third-raising via the
    // chord's own interval recipe.
    return scaleNote;
  }
  return scaleNote;
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

function suffixForNumeral(rn: RomanNumeral, key: Key): ChordSuffix {
  const isTriad = rn.inversion === '5/3' || rn.inversion === '6' || rn.inversion === '6/4';
  if (isTriad) {
    return TRIAD_SUFFIX_BY_QUALITY[rn.quality];
  }
  // Major-quality seventh chords whose chord-tone stack matches the
  // dominant-seventh shape (root-major3-perfect5-minor7). In a major
  // key that's only V7. In a natural-minor key it's both VII7 (the
  // diatonic dominant on the natural 7th) and uppercase V's
  // harmonic-minor V7.
  if (rn.quality === 'major' && isDominantSeventhDegree(rn, key)) {
    return 'dominantSeventh';
  }
  // Diminished sevenths in minor-key contexts: the leading-tone
  // diminished (vii°) takes the harmonic-minor 7th, which is a
  // *fully* diminished seventh (root-m3-d5-d7). Major-key vii°7 is
  // half-diminished by the natural-major spelling.
  if (rn.quality === 'diminished' && rn.degree === 7 && key.mode === 'minor') {
    return 'diminishedSeventh';
  }
  return SEVENTH_SUFFIX_BY_QUALITY[rn.quality];
}

function isDominantSeventhDegree(rn: RomanNumeral, key: Key): boolean {
  // Major-key diatonic dominant 7th lives only at V.
  if (key.mode === 'major') {
    return rn.degree === 5;
  }
  // Natural-minor diatonic dominant 7ths: VII (G-B-D-F in A minor) and V
  // when notated uppercase (= harmonic-minor V).
  return rn.degree === 5 || rn.degree === 7;
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
      const quality = qualityForChordSuffix(chord.suffix);
      if (quality === null) {
        // Diatonic chord with an unmapped suffix — should not occur
        // because `Scale.chords()`/`seventhChords()` only produce
        // suffixes covered by QUALITY_BY_DIATONIC_SUFFIX. If the scale
        // catalog ever extends to produce something new (sus chords on
        // a degree, etc.), this return-null lets the caller try the
        // next match instead of fabricating a wrong-quality numeral.
        continue;
      }
      return unsafeRomanNumeralFromParts(
        degree,
        quality,
        inversionForChord(chord, isSeventhChord),
        undefined,
        undefined,
      );
    }
  }
  return null;
}

const degreesByIndex: readonly RomanNumeralDegree[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * The chord suffixes that the diatonic chord set can produce — every
 * suffix `Scale.chords()` and `Scale.seventhChords()` may return for a
 * major or natural-minor scale. `qualityForChordSuffix` accepts any
 * `ChordSuffix` because callers receive `chord.suffix` typed widely,
 * but the function only produces a meaningful answer for these
 * diatonic suffixes; everything else falls back to `null`, which the
 * single caller (`identifyRomanNumeral`) treats as "not a recognized
 * Roman-numeral chord type yet" — extended in roadmap items 2.11/2.12.
 */
const QUALITY_BY_DIATONIC_SUFFIX: ReadonlyMap<ChordSuffix, RomanNumeralQuality> = new Map<
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

function qualityForChordSuffix(suffix: ChordSuffix): RomanNumeralQuality | null {
  return QUALITY_BY_DIATONIC_SUFFIX.get(suffix) ?? null;
}

function inversionForChord(chord: Chord, isSeventh: boolean): RomanNumeralInversion {
  const table = isSeventh ? SEVENTH_INVERSION_BY_INDEX : TRIAD_INVERSION_BY_INDEX;
  const index = chord.inversionIndex;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  return table[index] ?? table[0]!;
}
