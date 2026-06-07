import { INTERVALS, invertInterval, resolveInterval, type Interval } from './intervals.js';
import { Note, applyInterval, type NoteLike } from './note.js';
import type { Clef } from './clef.js';

/**
 * The instrument family classification for grouping and display.
 */
export type InstrumentFamily =
  | 'voice'
  | 'keyboard'
  | 'string'
  | 'woodwind'
  | 'brass'
  | 'percussion'
  | 'other';

/**
 * The complete definition of an instrument in the catalog.
 *
 * `concertRange`, `writtenRange`, and `comfortableRange` are expressed as
 * `[low, high]` pairs of note strings. All three are at **concert pitch**.
 * Non-transposing instruments omit `transposition`; transposing instruments
 * store the magnitude as an ascending interval — the convention is that written
 * pitch is UP by `transposition` from concert pitch (i.e. concert is DOWN by
 * `transposition` from written).
 */
export type InstrumentDefinition = {
  readonly name: string;
  readonly family: InstrumentFamily;
  readonly concertRange?: readonly [string, string];
  readonly writtenRange?: readonly [string, string];
  readonly comfortableRange?: readonly [string, string];
  readonly transposition?: Interval;
  readonly defaultClefs?: readonly Clef[];
};

/**
 * The resolved [low, high] Note pair for an instrument range.
 */
export type InstrumentRange = {
  readonly low: Note;
  readonly high: Note;
};

/**
 * The canonical instrument names available in the catalog.
 */
export type InstrumentName =
  | 'sopranoVoice'
  | 'altoVoice'
  | 'tenorVoice'
  | 'bassVoice'
  | 'piano'
  | 'guitar'
  | 'doubleBass'
  | 'violin'
  | 'viola'
  | 'cello'
  | 'flute'
  | 'clarinetBb'
  | 'altoSaxEb'
  | 'tenorSaxBb'
  | 'trumpetBb'
  | 'hornF'
  | 'trombone'
  | 'tuba';

/**
 * Any value that resolves to an instrument definition: a catalog name or a
 * direct definition object.
 */
export type InstrumentLike = InstrumentName | InstrumentDefinition;

const CANONICAL_INSTRUMENTS: Record<InstrumentName, InstrumentDefinition> = {
  sopranoVoice: {
    name: 'Soprano',
    family: 'voice',
    concertRange: ['C4', 'C6'],
    comfortableRange: ['D4', 'A5'],
    defaultClefs: ['treble'],
  },
  altoVoice: {
    name: 'Alto',
    family: 'voice',
    concertRange: ['F3', 'F5'],
    comfortableRange: ['G3', 'D5'],
    defaultClefs: ['treble'],
  },
  tenorVoice: {
    name: 'Tenor',
    family: 'voice',
    concertRange: ['C3', 'C5'],
    comfortableRange: ['D3', 'A4'],
    defaultClefs: ['treble'],
  },
  bassVoice: {
    name: 'Bass',
    family: 'voice',
    concertRange: ['E2', 'E4'],
    comfortableRange: ['F2', 'C4'],
    defaultClefs: ['bass'],
  },
  piano: {
    name: 'Piano',
    family: 'keyboard',
    concertRange: ['A0', 'C8'],
    defaultClefs: ['treble', 'bass'],
  },
  guitar: {
    name: 'Guitar',
    family: 'string',
    // Concert range: sounds an octave lower than written (octave transposer)
    concertRange: ['E2', 'B5'],
    // Written range (as notated in treble clef, one octave higher)
    writtenRange: ['E3', 'B6'],
    transposition: 'perfectOctave',
    defaultClefs: ['treble'],
  },
  doubleBass: {
    name: 'Double Bass',
    family: 'string',
    // Concert range: sounds an octave lower than written
    concertRange: ['E1', 'G4'],
    writtenRange: ['E2', 'G5'],
    transposition: 'perfectOctave',
    defaultClefs: ['bass'],
  },
  violin: {
    name: 'Violin',
    family: 'string',
    concertRange: ['G3', 'A7'],
    comfortableRange: ['G3', 'E6'],
    defaultClefs: ['treble'],
  },
  viola: {
    name: 'Viola',
    family: 'string',
    concertRange: ['C3', 'E6'],
    comfortableRange: ['C3', 'C5'],
    defaultClefs: ['alto', 'treble'],
  },
  cello: {
    name: 'Cello',
    family: 'string',
    concertRange: ['C2', 'A5'],
    comfortableRange: ['C2', 'D5'],
    defaultClefs: ['bass', 'tenor', 'treble'],
  },
  flute: {
    name: 'Flute',
    family: 'woodwind',
    concertRange: ['C4', 'D7'],
    comfortableRange: ['D4', 'G6'],
    defaultClefs: ['treble'],
  },
  clarinetBb: {
    name: 'Clarinet in Bb',
    family: 'woodwind',
    // Concert range: sounds a major 2nd lower than written
    concertRange: ['D3', 'Bb6'],
    writtenRange: ['E3', 'C7'],
    // Comfortable range in CONCERT pitch (written E3–G6 transposed down M2)
    comfortableRange: ['D3', 'F6'],
    transposition: 'majorSecond',
    defaultClefs: ['treble'],
  },
  altoSaxEb: {
    name: 'Alto Saxophone in Eb',
    family: 'woodwind',
    // Concert range: sounds a major 6th lower than written
    concertRange: ['Db3', 'Ab5'],
    writtenRange: ['Bb3', 'F6'],
    // Comfortable range in CONCERT pitch (written Bb3–Eb6 transposed down M6)
    comfortableRange: ['Db3', 'Gb5'],
    transposition: 'majorSixth',
    defaultClefs: ['treble'],
  },
  tenorSaxBb: {
    name: 'Tenor Saxophone in Bb',
    family: 'woodwind',
    // Concert range: sounds a major 9th (M2 + octave) lower than written
    concertRange: ['Ab2', 'E5'],
    writtenRange: ['Bb3', 'F6'],
    // Comfortable range in CONCERT pitch (written Bb3–Eb6 transposed down M9)
    comfortableRange: ['Ab2', 'Db5'],
    transposition: 'majorNinth',
    defaultClefs: ['treble'],
  },
  trumpetBb: {
    name: 'Trumpet in Bb',
    family: 'brass',
    // Concert range: sounds a major 2nd lower than written
    concertRange: ['E3', 'Bb5'],
    writtenRange: ['F#3', 'C6'],
    // Comfortable range in CONCERT pitch (written F#3–Bb5 transposed down M2)
    comfortableRange: ['E3', 'Ab5'],
    transposition: 'majorSecond',
    defaultClefs: ['treble'],
  },
  hornF: {
    name: 'Horn in F',
    family: 'brass',
    // Concert range: sounds a perfect 5th lower than written
    concertRange: ['B1', 'F5'],
    writtenRange: ['F#2', 'C6'],
    // Comfortable range in CONCERT pitch (written F#2–F5 transposed down P5)
    comfortableRange: ['B1', 'Bb4'],
    transposition: 'perfectFifth',
    defaultClefs: ['treble'],
  },
  trombone: {
    name: 'Trombone',
    family: 'brass',
    concertRange: ['E2', 'F5'],
    comfortableRange: ['E2', 'Bb4'],
    defaultClefs: ['bass', 'tenor'],
  },
  tuba: {
    name: 'Tuba',
    family: 'brass',
    concertRange: ['D1', 'F4'],
    comfortableRange: ['D1', 'Bb3'],
    defaultClefs: ['bass'],
  },
} satisfies Record<InstrumentName, InstrumentDefinition>;

/**
 * The frozen catalog of standard orchestral and band instruments.
 *
 * Each entry carries the instrument name, family, ranges (concert and, where
 * applicable, written), and optional comfortable range and default clefs.
 * Transposing instruments store a `transposition` interval representing the
 * ascending distance from concert pitch to written pitch (i.e. written is
 * UP by this interval; concert is DOWN).
 */
export const INSTRUMENTS: Readonly<Record<InstrumentName, InstrumentDefinition>> =
  Object.freeze(CANONICAL_INSTRUMENTS);

/**
 * Resolves an instrument-like value to its definition.
 *
 * @param instrument The instrument name or definition to resolve.
 * @returns The resolved instrument definition.
 * @throws {TypeError} When the name is not in the catalog.
 */
export function resolveInstrument(instrument: InstrumentLike): InstrumentDefinition {
  if (typeof instrument === 'string') {
    const definition = CANONICAL_INSTRUMENTS[instrument];
    if (!definition) {
      throw new TypeError(`Unknown instrument: ${instrument}.`);
    }
    return definition;
  }
  return instrument;
}

/**
 * Transposes a note DOWN by a spelled interval, preserving enharmonic spelling.
 *
 * Down by interval I = up by invert(I) then down one octave per total octave
 * span (1 for simple intervals, 2+ for compound). This is the only way to get
 * spelling-correct downward transposition using `applyInterval`.
 */
function transposeDown(note: Note, interval: Interval): Note {
  const canonical = resolveInterval(interval);
  const inverted = invertInterval(canonical);
  const info = INTERVALS[canonical];
  // For a compound interval (e.g. majorNinth), octaveOffset = 1 so we go up
  // by the inversion (minorSeventh) and then down by 1 + 1 = 2 octaves.
  const octavesDown = 1 + info.octaveOffset;
  return applyInterval(note, inverted).down(octavesDown);
}

/**
 * Returns the [low, high] Note pair for an instrument's concert range.
 *
 * @param instrument The instrument name or definition.
 * @returns The resolved concert range as Note instances.
 * @throws {TypeError} When the instrument has no concert range or the name is unknown.
 */
export function instrumentRange(instrument: InstrumentLike): InstrumentRange {
  const definition = resolveInstrument(instrument);
  if (!definition.concertRange) {
    throw new TypeError(`Instrument "${definition.name}" has no concert range defined.`);
  }
  const [low, high] = definition.concertRange;
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return { low: Note.create(low as NoteLike), high: Note.create(high as NoteLike) };
}

/**
 * Converts a concert pitch to written pitch for a transposing instrument.
 *
 * For a Bb clarinet, concert Bb3 → written C4 (up a major 2nd).
 * For non-transposing instruments the note is returned unchanged.
 *
 * @param instrument The instrument name or definition.
 * @param concertPitch The concert pitch to convert.
 * @returns The written pitch.
 * @throws {TypeError} When the instrument name is unknown.
 */
export function toWrittenPitch(instrument: InstrumentLike, concertPitch: NoteLike): Note {
  const definition = resolveInstrument(instrument);
  const note = Note.create(concertPitch);
  if (!definition.transposition) {
    return note;
  }
  return applyInterval(note, definition.transposition);
}

/**
 * Converts a written pitch to concert pitch for a transposing instrument.
 *
 * For a Bb clarinet, written C4 → concert Bb3 (down a major 2nd).
 * For non-transposing instruments the note is returned unchanged.
 *
 * @param instrument The instrument name or definition.
 * @param writtenPitch The written pitch to convert.
 * @returns The concert pitch.
 * @throws {TypeError} When the instrument name is unknown.
 */
export function toConcertPitch(instrument: InstrumentLike, writtenPitch: NoteLike): Note {
  const definition = resolveInstrument(instrument);
  const note = Note.create(writtenPitch);
  if (!definition.transposition) {
    return note;
  }
  return transposeDown(note, definition.transposition);
}

/**
 * Options for {@link isInInstrumentRange}.
 */
export type InstrumentRangeOptions = {
  /**
   * Which range to check against. Defaults to `'concert'`.
   *
   * - `'concert'` — full playable range at concert pitch.
   * - `'written'` — full playable range at written pitch.
   * - `'comfortable'` — comfortable performance range (subset of concert).
   */
  readonly range?: 'concert' | 'written' | 'comfortable';
};

/**
 * Returns `true` when a note falls within an instrument's range.
 *
 * @param instrument The instrument name or definition.
 * @param note The note to check.
 * @param options Options controlling which range to use.
 * @returns `true` when the note is within the selected range.
 * @throws {TypeError} When the instrument name is unknown, or the requested range is not defined.
 */
export function isInInstrumentRange(
  instrument: InstrumentLike,
  note: NoteLike,
  options?: InstrumentRangeOptions,
): boolean {
  const definition = resolveInstrument(instrument);
  const kind = options?.range ?? 'concert';
  const target = Note.create(note);

  let rangePair: readonly [string, string] | undefined;
  if (kind === 'comfortable') {
    rangePair = definition.comfortableRange;
  } else if (kind === 'written') {
    if (definition.writtenRange !== undefined) {
      rangePair = definition.writtenRange;
    } else if (definition.transposition !== undefined && definition.concertRange !== undefined) {
      // Transposing instrument with no explicit writtenRange: derive from concert range.
      const [concertLow, concertHigh] = definition.concertRange;
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      const writtenLow = toWrittenPitch(definition, concertLow as NoteLike).toString();
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      const writtenHigh = toWrittenPitch(definition, concertHigh as NoteLike).toString();
      rangePair = [writtenLow, writtenHigh];
    } else {
      // Non-transposing instrument: written == concert.
      rangePair = definition.concertRange;
    }
  } else {
    rangePair = definition.concertRange;
  }

  if (!rangePair) {
    throw new TypeError(`Instrument "${definition.name}" has no ${kind} range defined.`);
  }

  const [low, high] = rangePair;
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  const lowNote = Note.create(low as NoteLike);
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  const highNote = Note.create(high as NoteLike);

  return target.midi >= lowNote.midi && target.midi <= highNote.midi;
}
