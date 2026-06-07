import { describe, expect, it } from 'bun:test';

import { Chord } from './chord.js';
import { Key } from './key.js';
import { Note } from './note.js';
import {
  analyzeVoiceLeading,
  commonTones,
  findParallelPerfects,
  leadingToneResolutions,
  voiceMotion,
} from './voice-leading.js';

// ---------------------------------------------------------------------------
// voiceMotion
// ---------------------------------------------------------------------------

describe('voiceMotion', () => {
  it('classifies parallel motion: same direction, same generic interval', () => {
    // Both up a step, a third apart at start and end (C-E → D-F = M3→m3, generic thirds)
    expect(
      voiceMotion([Note.create('C4'), Note.create('D4')], [Note.create('E4'), Note.create('F4')]),
    ).toBe('parallel');
  });

  it('classifies parallel motion: P5→P5 same direction up by step', () => {
    // C4-G4 → D4-A4: both up 2 semitones, both generic fifths → parallel
    expect(
      voiceMotion([Note.create('C4'), Note.create('D4')], [Note.create('G4'), Note.create('A4')]),
    ).toBe('parallel');
  });

  it('classifies parallel motion: both up a third, fifths maintained', () => {
    // C4-E4 → E4-B4? No: C4-G4 → E4-B4: both up a third (generic fifth stays)
    expect(
      voiceMotion([Note.create('C4'), Note.create('E4')], [Note.create('G4'), Note.create('B4')]),
    ).toBe('parallel');
  });

  it('classifies similar motion: same direction, different generic interval', () => {
    // C4 up step to D4; E4 up a fourth to A4 → both up, but P3→P4 or M3→P4 = similar
    expect(
      voiceMotion([Note.create('C4'), Note.create('D4')], [Note.create('E4'), Note.create('A4')]),
    ).toBe('similar');
  });

  it('classifies contrary motion: one up, one down', () => {
    expect(
      voiceMotion([Note.create('C4'), Note.create('D4')], [Note.create('E4'), Note.create('C4')]),
    ).toBe('contrary');
  });

  it('classifies contrary motion: lower up, upper down', () => {
    expect(
      voiceMotion([Note.create('G3'), Note.create('B3')], [Note.create('C4'), Note.create('A3')]),
    ).toBe('contrary');
  });

  it('classifies oblique motion: one voice stationary', () => {
    // C4 stays, G4 moves up
    expect(
      voiceMotion([Note.create('C4'), Note.create('C4')], [Note.create('G4'), Note.create('A4')]),
    ).toBe('oblique');
  });

  it('classifies oblique motion: upper voice stationary', () => {
    expect(
      voiceMotion([Note.create('C4'), Note.create('D4')], [Note.create('G4'), Note.create('G4')]),
    ).toBe('oblique');
  });

  it('classifies oblique motion: both voices stationary', () => {
    expect(
      voiceMotion([Note.create('C4'), Note.create('C4')], [Note.create('G4'), Note.create('G4')]),
    ).toBe('oblique');
  });

  it('handles contrary motion: lower down, upper up', () => {
    expect(
      voiceMotion([Note.create('E4'), Note.create('D4')], [Note.create('G4'), Note.create('A4')]),
    ).toBe('contrary');
  });
});

// ---------------------------------------------------------------------------
// findParallelPerfects
// ---------------------------------------------------------------------------

describe('findParallelPerfects', () => {
  // Hand-derived cases from the issue spec:

  it('detects parallel fifths: (C4,G4)→(D4,A4) both up a step', () => {
    const from = [Note.create('C4'), Note.create('G4')];
    const to = [Note.create('D4'), Note.create('A4')];
    const issues = findParallelPerfects(from, to);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.type).toBe('parallel-fifth');
    expect(issues[0]?.lowerVoiceIndex).toBe(0);
    expect(issues[0]?.upperVoiceIndex).toBe(1);
  });

  it('detects parallel fifths: (C4,G4)→(E4,B4) both up a third', () => {
    const from = [Note.create('C4'), Note.create('G4')];
    const to = [Note.create('E4'), Note.create('B4')];
    const issues = findParallelPerfects(from, to);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.type).toBe('parallel-fifth');
  });

  it('detects parallel octaves: (C4,C5)→(D4,D5)', () => {
    const from = [Note.create('C4'), Note.create('C5')];
    const to = [Note.create('D4'), Note.create('D5')];
    const issues = findParallelPerfects(from, to);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.type).toBe('parallel-octave');
  });

  it('does NOT flag contrary motion into a fifth', () => {
    // Lower goes down (C4→B3), upper goes up (G4→A4) → contrary motion, not parallel
    const from = [Note.create('C4'), Note.create('G4')];
    const to = [Note.create('B3'), Note.create('A4')];
    expect(findParallelPerfects(from, to)).toHaveLength(0);
  });

  it('does NOT flag oblique motion into a fifth (common tone holds)', () => {
    // Lower stays on C4; upper moves from F4 to G4 → P4→P5, but lower is static
    const from = [Note.create('C4'), Note.create('F4')];
    const to = [Note.create('C4'), Note.create('G4')];
    expect(findParallelPerfects(from, to)).toHaveLength(0);
  });

  it('does NOT flag similar motion into a fifth (unequal deltas)', () => {
    // Lower moves C4→D4 (+2), upper moves G4→A4 (+2) is parallel — but with C4→C#4 (+1)
    // and G4→Ab4 (+1) → P5→d5, same direction but unequal deltas (both 1, gap changes)
    // Actually with equal deltas we'd flag it; test: lower +2, upper +3 = similar, no flag
    const from = [Note.create('C4'), Note.create('G4')];
    const to = [Note.create('D4'), Note.create('B4')]; // lower +2, upper +4 → different deltas
    expect(findParallelPerfects(from, to)).toHaveLength(0);
  });

  it('does NOT flag when both voices are stationary on a fifth', () => {
    const from = [Note.create('C4'), Note.create('G4')];
    const to = [Note.create('C4'), Note.create('G4')];
    expect(findParallelPerfects(from, to)).toHaveLength(0);
  });

  it('detects parallel fifths in a 4-voice SATB-style context', () => {
    // Bass: C3→D3, Alto: G3→A3 (parallel fifths), Tenor: E4→F4, Soprano: C5→D5
    const from = [Note.create('C3'), Note.create('G3'), Note.create('E4'), Note.create('C5')];
    const to = [Note.create('D3'), Note.create('A3'), Note.create('F4'), Note.create('D5')];
    const issues = findParallelPerfects(from, to);
    // Bass-Alto: parallel fifth (C3-G3 → D3-A3)
    // Soprano-Alto: C5-G3 gap = 21 → 21 % 12 = 9, not a fifth/octave
    // Soprano-Bass: C5-C3 → D5-D3: gap = 24, 24 % 12 = 0, gap ≠ 0 → parallel octave
    const fifths = issues.filter((i) => i.type === 'parallel-fifth');
    const octaves = issues.filter((i) => i.type === 'parallel-octave');
    expect(fifths.length).toBe(1); // Bass-Alto: C3-G3 → D3-A3
    expect(octaves.length).toBe(1); // Bass-Soprano: C3-C5 → D3-D5
  });

  it('throws when voicings have different lengths', () => {
    const from = [Note.create('C4'), Note.create('G4')];
    const to = [Note.create('D4')];
    expect(() => findParallelPerfects(from, to)).toThrow(RangeError);
  });

  it('works with ChordVoicing inputs', () => {
    const cMaj = Chord.create('C4', 'major');
    const gMaj = Chord.create('G4', 'major');
    // Chord.notes are in root position; detect issues in the parallel motion
    const result = findParallelPerfects(cMaj, gMaj);
    expect(Array.isArray(result)).toBe(true);
  });

  it('detects parallel octave across a double octave (gap=24)', () => {
    // Lower: C3, upper: C5 (gap=24, 24 % 12 = 0, gap ≠ 0)
    const from = [Note.create('C3'), Note.create('C5')];
    const to = [Note.create('D3'), Note.create('D5')];
    const issues = findParallelPerfects(from, to);
    expect(issues[0]?.type).toBe('parallel-octave');
  });
});

// ---------------------------------------------------------------------------
// commonTones
// ---------------------------------------------------------------------------

describe('commonTones', () => {
  it('returns common pitch classes between C major and A minor (C and E)', () => {
    // C major: C-E-G; A minor: A-C-E → common = C, E
    const cMaj = Chord.create('C4', 'major');
    const aMin = Chord.create('A4', 'minor');
    const tones = commonTones(cMaj, aMin);
    const names = tones.map((n) => n.note).toSorted();
    expect(names).toContain('C');
    expect(names).toContain('E');
    expect(tones).toHaveLength(2);
  });

  it('returns empty array when no pitch classes are shared', () => {
    // C major: C-E-G; F# major: F#-A#-C# → no common pitch classes
    const cMaj = Chord.create('C4', 'major');
    const fSharpMaj = Chord.create('F#4', 'major');
    expect(commonTones(cMaj, fSharpMaj)).toHaveLength(0);
  });

  it('deduplicates repeated pitch classes in the result', () => {
    // Both voicings have C duplicated across octaves
    const from = [Note.create('C3'), Note.create('C4'), Note.create('G4')];
    const to = [Note.create('C4'), Note.create('E4'), Note.create('G5')];
    const tones = commonTones(from, to);
    // C and G are common, deduplicated to one each
    const names = tones.map((n) => n.note).toSorted();
    expect(names).toContain('C');
    expect(names).toContain('G');
    expect(tones).toHaveLength(2);
  });

  it('treats enharmonic equivalents as the same pitch class', () => {
    // C# and Db have the same pitch class (1)
    const from = [Note.create('C#4'), Note.create('E4'), Note.create('G#4')];
    const to = [Note.create('Db4'), Note.create('F4'), Note.create('Ab4')];
    const tones = commonTones(from, to);
    // C# (=Db) and G# (=Ab) are common
    expect(tones).toHaveLength(2);
  });

  it('works with ChordVoicing input', () => {
    const cMaj = Chord.create('C4', 'major');
    const cVoicing = cMaj.closeVoicing();
    const aMin = Chord.create('A4', 'minor');
    const tones = commonTones(cVoicing, aMin);
    expect(tones).toHaveLength(2);
  });

  it('returns all notes when both voicings are identical', () => {
    const from = [Note.create('C4'), Note.create('E4'), Note.create('G4')];
    const to = [Note.create('C4'), Note.create('E4'), Note.create('G4')];
    expect(commonTones(from, to)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// analyzeVoiceLeading
// ---------------------------------------------------------------------------

describe('analyzeVoiceLeading', () => {
  it('reports correct per-voice steps for a simple two-voice motion', () => {
    const from = [Note.create('C4'), Note.create('E4')];
    const to = [Note.create('D4'), Note.create('F4')];
    const analysis = analyzeVoiceLeading(from, to);
    expect(analysis.steps).toHaveLength(2);
    expect(analysis.steps[0]?.semitones).toBe(2); // C→D = +2
    expect(analysis.steps[0]?.direction).toBe('up');
    expect(analysis.steps[0]?.interval).toBe('majorSecond'); // ascending: M2
    expect(analysis.steps[1]?.semitones).toBe(1); // E→F = +1
    expect(analysis.steps[1]?.direction).toBe('up');
    expect(analysis.steps[1]?.interval).toBe('minorSecond'); // ascending: m2
  });

  it('reports descending motion with correct interval name', () => {
    const from = [Note.create('G4'), Note.create('D5')];
    const to = [Note.create('F4'), Note.create('C5')];
    const analysis = analyzeVoiceLeading(from, to);
    expect(analysis.steps[0]?.direction).toBe('down');
    expect(analysis.steps[0]?.semitones).toBe(-2);
    expect(analysis.steps[0]?.interval).toBe('majorSecond'); // descending G→F: still M2
    expect(analysis.steps[1]?.direction).toBe('down');
    expect(analysis.steps[1]?.semitones).toBe(-2);
    expect(analysis.steps[1]?.interval).toBe('majorSecond'); // descending D→C: M2
  });

  it('reports stationary voice', () => {
    const from = [Note.create('C4'), Note.create('G4')];
    const to = [Note.create('C4'), Note.create('A4')];
    const analysis = analyzeVoiceLeading(from, to);
    expect(analysis.steps[0]?.direction).toBe('same');
    expect(analysis.steps[0]?.semitones).toBe(0);
    expect(analysis.steps[0]?.interval).toBeNull();
  });

  it('includes motion classification for all voice pairs', () => {
    // 4-voice SATB: contrary outer, oblique inner
    const from = [Note.create('C3'), Note.create('E4'), Note.create('G4'), Note.create('C5')];
    const to = [Note.create('D3'), Note.create('F4'), Note.create('A4'), Note.create('B4')];
    const analysis = analyzeVoiceLeading(from, to);
    expect(analysis.motions).toHaveLength(3);
  });

  it('throws when voicing lengths differ', () => {
    const from = [Note.create('C4'), Note.create('G4')];
    const to = [Note.create('D4')];
    expect(() => analyzeVoiceLeading(from, to)).toThrow(RangeError);
  });

  it('assigns voice indices by array position', () => {
    const from = [Note.create('G3'), Note.create('B3'), Note.create('D4')];
    const to = [Note.create('A3'), Note.create('C4'), Note.create('E4')];
    const analysis = analyzeVoiceLeading(from, to);
    expect(analysis.steps[0]?.voiceIndex).toBe(0);
    expect(analysis.steps[1]?.voiceIndex).toBe(1);
    expect(analysis.steps[2]?.voiceIndex).toBe(2);
  });

  it('classifies motion between adjacent pairs', () => {
    // All three voices move up a step → parallel motion between each pair
    const from = [Note.create('C4'), Note.create('E4'), Note.create('G4')];
    const to = [Note.create('D4'), Note.create('F4'), Note.create('A4')];
    const analysis = analyzeVoiceLeading(from, to);
    // Lower pair (C→D, E→F): same direction, generic thirds in both → parallel
    // Upper pair (E→F, G→A): same direction, generic thirds in both → parallel
    for (const m of analysis.motions) {
      expect(['parallel', 'similar']).toContain(m.motion);
    }
  });
});

// ---------------------------------------------------------------------------
// leadingToneResolutions
// ---------------------------------------------------------------------------

describe('leadingToneResolutions', () => {
  it('detects leading-tone resolution in V→I (C major): B→C resolves correctly', () => {
    // V chord in C major: G-B-D → I chord: C-E-G
    // B (leading tone, semitoneFromTonic=11) should resolve up to C
    const key = Key.create('C', 'major');
    const from = [Note.create('G4'), Note.create('B4'), Note.create('D5')];
    const to = [Note.create('C4'), Note.create('C5'), Note.create('E5')];
    const checks = leadingToneResolutions(key, from, to);
    const ltChecks = checks.filter((c) => c.type === 'leading-tone');
    expect(ltChecks).toHaveLength(1);
    expect(ltChecks[0].resolved).toBe(true);
    expect(ltChecks[0].from.note).toBe('B');
    expect(ltChecks[0].to.note).toBe('C');
  });

  it('marks an unresolved leading tone (B→A, wrong direction)', () => {
    const key = Key.create('C', 'major');
    const from = [Note.create('G4'), Note.create('B4'), Note.create('D5')];
    const to = [Note.create('F4'), Note.create('A4'), Note.create('D5')];
    const checks = leadingToneResolutions(key, from, to);
    const ltChecks = checks.filter((c) => c.type === 'leading-tone');
    expect(ltChecks).toHaveLength(1);
    expect(ltChecks[0].resolved).toBe(false);
  });

  it('detects chordal-seventh resolution for a V7 chord (G7→C)', () => {
    // G7 in C major: G-B-D-F. F (chordal 7th) should resolve down by step to E
    const key = Key.create('C', 'major');
    const g7 = Chord.create('G3', 'dominantSeventh').closeVoicing();
    // To voicing: C-E-G-E (I chord spread)
    const to = [Note.create('C3'), Note.create('E4'), Note.create('G4'), Note.create('E4')];
    const checks = leadingToneResolutions(key, g7, to);
    const seventhChecks = checks.filter((c) => c.type === 'chordal-seventh');
    expect(seventhChecks).toHaveLength(1);
    const check = seventhChecks[0];
    expect(check.from.note).toBe('F');
    expect(check.resolved).toBe(true); // F→E = -1 semitone ✓
  });

  it('marks chordal seventh as unresolved when it leaps', () => {
    const key = Key.create('C', 'major');
    const g7 = Chord.create('G3', 'dominantSeventh').closeVoicing();
    // F (7th) leaps up to Bb instead of resolving down
    const to = [Note.create('C3'), Note.create('E4'), Note.create('G4'), Note.create('Bb4')];
    const checks = leadingToneResolutions(key, g7, to);
    const seventhChecks = checks.filter((c) => c.type === 'chordal-seventh');
    expect(seventhChecks).toHaveLength(1);
    expect(seventhChecks[0].resolved).toBe(false);
  });

  it('returns no checks when there are no tendency tones', () => {
    // C major chord has no leading tone or chordal seventh
    const key = Key.create('C', 'major');
    const from = [Note.create('C4'), Note.create('E4'), Note.create('G4')];
    const to = [Note.create('F4'), Note.create('A4'), Note.create('C5')];
    const checks = leadingToneResolutions(key, from, to);
    expect(checks).toHaveLength(0);
  });

  it('throws when voicing lengths differ', () => {
    const key = Key.create('C', 'major');
    const from = [Note.create('G4'), Note.create('B4'), Note.create('D5')];
    const to = [Note.create('C4')];
    expect(() => leadingToneResolutions(key, from, to)).toThrow(RangeError);
  });

  it('detects leading tone in G major (F# leading tone → G)', () => {
    const key = Key.create('G', 'major');
    // D-F#-A → G-G-B: F# resolves up to G
    const from = [Note.create('D4'), Note.create('F#4'), Note.create('A4')];
    const to = [Note.create('G4'), Note.create('G4'), Note.create('B4')];
    const checks = leadingToneResolutions(key, from, to);
    const ltChecks = checks.filter((c) => c.type === 'leading-tone');
    expect(ltChecks).toHaveLength(1);
    expect(ltChecks[0].resolved).toBe(true);
  });

  it('does not require ChordVoicing for leading-tone detection', () => {
    // Raw Note[] is fine for LT checks
    const key = Key.create('C', 'major');
    const from = [Note.create('B4')];
    const to = [Note.create('C5')];
    const checks = leadingToneResolutions(key, from, to);
    expect(checks).toHaveLength(1);
    expect(checks[0].type).toBe('leading-tone');
    expect(checks[0].resolved).toBe(true);
  });

  it('chordal-seventh: resolves down a whole step (Bb→Ab, minor 7th context)', () => {
    // Cm7 = C-Eb-G-Bb. The chordal 7th is Bb. Resolve Bb→Ab = down 2 semitones.
    const key = Key.create('Ab', 'major');
    const cm7 = Chord.create('C4', 'minorSeventh').closeVoicing();
    // Bb→Ab = down 2 semitones (whole step) ✓
    const to = [Note.create('C4'), Note.create('Eb4'), Note.create('G4'), Note.create('Ab4')];
    const checks = leadingToneResolutions(key, cm7, to);
    const seventhChecks = checks.filter((c) => c.type === 'chordal-seventh');
    expect(seventhChecks).toHaveLength(1);
    expect(seventhChecks[0].resolved).toBe(true);
    expect(seventhChecks[0].from.note).toBe('Bb');
  });
});
