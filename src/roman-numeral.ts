// roman-numeral.ts: parser, renderer, and value type for Roman-numeral
// chord symbols. Key-aware operations (`chordFromRomanNumeral`,
// `romanNumeralFor`) live in `key-roman.ts` to avoid a static circular
// import between this module and `key.ts`.

/**
 * The chord quality conveyed by a Roman-numeral symbol.
 *
 * - `'major'` and `'augmented'`: rendered uppercase (`I`, `III+`).
 * - `'minor'` and `'diminished'`: rendered lowercase (`i`, `vii°`).
 *
 * Richer qualities (dominant, half-diminished, etc.) are determined by
 * inversion + the chord built from the Roman numeral, not by the symbol.
 */
export type RomanNumeralQuality = 'major' | 'minor' | 'diminished' | 'augmented';

/**
 * A chromatic alteration on the scale degree (e.g., `♭III`, `♯iv°`).
 */
export type RomanNumeralAlteration = 'flat' | 'sharp';

/**
 * The diatonic scale degree (1–7) targeted by a Roman numeral.
 */
export type RomanNumeralDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * The inversion figure attached to a Roman numeral.
 *
 * Identifiers follow figured-bass convention:
 * - `'5/3'` (root position triad)
 * - `'6'` (first inversion triad)
 * - `'6/4'` (second inversion triad)
 * - `'7'` (root position seventh)
 * - `'6/5'` (first inversion seventh)
 * - `'4/3'` (second inversion seventh)
 * - `'4/2'` (third inversion seventh)
 */
export type RomanNumeralInversion = '5/3' | '6' | '6/4' | '7' | '6/5' | '4/3' | '4/2';

/**
 * A serialized snapshot of a {@link RomanNumeral}.
 */
export type SerializedRomanNumeral = {
  readonly degree: RomanNumeralDegree;
  readonly quality: RomanNumeralQuality;
  readonly inversion: RomanNumeralInversion;
  readonly alteration?: RomanNumeralAlteration;
  readonly applied?: SerializedRomanNumeral;
};

/**
 * Inputs accepted by {@link RomanNumeral.create}.
 */
export type RomanNumeralLike = RomanNumeral | string | SerializedRomanNumeral;

let createRomanNumeral: (
  degree: RomanNumeralDegree,
  quality: RomanNumeralQuality,
  inversion: RomanNumeralInversion,
  alteration: RomanNumeralAlteration | undefined,
  applied: RomanNumeral | undefined,
) => RomanNumeral;

const VALID_DEGREES: ReadonlySet<RomanNumeralDegree> = new Set<RomanNumeralDegree>([
  1, 2, 3, 4, 5, 6, 7,
]);
const VALID_QUALITIES: ReadonlySet<RomanNumeralQuality> = new Set<RomanNumeralQuality>([
  'major',
  'minor',
  'diminished',
  'augmented',
]);
const VALID_INVERSIONS: ReadonlySet<RomanNumeralInversion> = new Set<RomanNumeralInversion>([
  '5/3',
  '6',
  '6/4',
  '7',
  '6/5',
  '4/3',
  '4/2',
]);
const VALID_ALTERATIONS: ReadonlySet<RomanNumeralAlteration> = new Set<RomanNumeralAlteration>([
  'flat',
  'sharp',
]);

/**
 * A Roman-numeral chord symbol — the lingua franca of harmonic analysis.
 *
 * Carries scale degree, quality (driving uppercase/lowercase
 * convention), inversion (figured-bass-style superscripts like `6`,
 * `6/4`, `4/3`), optional chromatic alteration (`♭III`, `♯iv°`), and
 * optional applied-chord target (`V7/V`, `vii°/iii`).
 *
 * Both ASCII and Unicode notation parse identically; rendering produces
 * Unicode symbols (with ASCII characters where no Unicode equivalent
 * applies — e.g., the empty inversion).
 */
export class RomanNumeral {
  readonly #degree: RomanNumeralDegree;
  readonly #quality: RomanNumeralQuality;
  readonly #inversion: RomanNumeralInversion;
  readonly #alteration: RomanNumeralAlteration | undefined;
  readonly #applied: RomanNumeral | undefined;

  /** @internal Use {@link RomanNumeral.create}, {@link RomanNumeral.parse}, or {@link RomanNumeral.fromJSON}. */
  protected constructor(
    degree: RomanNumeralDegree,
    quality: RomanNumeralQuality,
    inversion: RomanNumeralInversion,
    alteration: RomanNumeralAlteration | undefined,
    applied: RomanNumeral | undefined,
  ) {
    this.#degree = degree;
    this.#quality = quality;
    this.#inversion = inversion;
    this.#alteration = alteration;
    this.#applied = applied;
  }

  static {
    createRomanNumeral = (degree, quality, inversion, alteration, applied) =>
      new RomanNumeral(degree, quality, inversion, alteration, applied);
  }

  /**
   * Creates a Roman numeral from a string, an existing `RomanNumeral`,
   * or a serialized snapshot.
   */
  public static create(value: RomanNumeralLike): RomanNumeral {
    if (value instanceof RomanNumeral) {
      return value;
    }
    if (typeof value === 'string') {
      return RomanNumeral.parse(value);
    }
    return RomanNumeral.fromJSON(value);
  }

  /**
   * Parses a Roman-numeral string in ASCII or Unicode form.
   *
   * Examples (both forms accepted):
   * - `'I'`, `'V7'`, `'ii°'`, `'iv⁶'`, `'V⁶₄'`, `'V⁷/V'`
   * - `'I'`, `'V7'`, `'iio'`, `'iv6'`, `'V64'`, `'V7/V'`
   * - `'bVII'`, `'♭VII'`, `'#iv°'`, `'♯iv°'`
   *
   * @throws {TypeError} when the input is not a recognized Roman numeral.
   */
  public static parse(input: string): RomanNumeral {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      throw new TypeError('Cannot parse an empty Roman numeral.');
    }
    return parseRomanNumeralString(trimmed);
  }

  /**
   * Recreates a Roman numeral from a serialized snapshot.
   *
   * Each field is validated against its type-union member values; an
   * invalid snapshot throws `TypeError`. Recursive `applied` snapshots
   * are validated bottom-up.
   */
  public static fromJSON(value: SerializedRomanNumeral): RomanNumeral {
    if (!VALID_DEGREES.has(value.degree)) {
      throw new TypeError(
        `SerializedRomanNumeral.degree must be 1..7; got ${String(value.degree)}.`,
      );
    }
    if (!VALID_QUALITIES.has(value.quality)) {
      throw new TypeError(
        `SerializedRomanNumeral.quality must be one of ${[...VALID_QUALITIES].join(', ')}; ` +
          `got "${String(value.quality)}".`,
      );
    }
    if (!VALID_INVERSIONS.has(value.inversion)) {
      throw new TypeError(
        `SerializedRomanNumeral.inversion must be one of ${[...VALID_INVERSIONS].join(', ')}; ` +
          `got "${String(value.inversion)}".`,
      );
    }
    if (value.alteration !== undefined && !VALID_ALTERATIONS.has(value.alteration)) {
      throw new TypeError(
        `SerializedRomanNumeral.alteration must be undefined, 'flat', or 'sharp'; ` +
          `got "${String(value.alteration)}".`,
      );
    }
    const applied = value.applied ? RomanNumeral.fromJSON(value.applied) : undefined;
    return createRomanNumeral(
      value.degree,
      value.quality,
      value.inversion,
      value.alteration,
      applied,
    );
  }

  /**
   * Returns true when the value is a constructed {@link RomanNumeral}.
   */
  public static isRomanNumeral(value: unknown): value is RomanNumeral {
    return value instanceof RomanNumeral;
  }

  /** The diatonic scale degree (1–7) this numeral targets. */
  public get degree(): RomanNumeralDegree {
    return this.#degree;
  }

  /** The quality conveyed by the symbol's case + augmentation marker. */
  public get quality(): RomanNumeralQuality {
    return this.#quality;
  }

  /** The figured-bass inversion symbol attached to this numeral. */
  public get inversion(): RomanNumeralInversion {
    return this.#inversion;
  }

  /** The chromatic alteration on the degree, or `undefined` when diatonic. */
  public get alteration(): RomanNumeralAlteration | undefined {
    return this.#alteration;
  }

  /** The applied target (the `x` in `V7/x`), or `undefined`. */
  public get applied(): RomanNumeral | undefined {
    return this.#applied;
  }

  /** Whether this numeral is an applied (secondary) chord like `V7/V`. */
  public get isApplied(): boolean {
    return this.#applied !== undefined;
  }

  /** Renders this Roman numeral as a Unicode string. */
  public toString(): string {
    return renderRomanNumeral(this);
  }

  /** Returns the serialized snapshot for this numeral. */
  public toJSON(): SerializedRomanNumeral {
    return {
      degree: this.#degree,
      quality: this.#quality,
      inversion: this.#inversion,
      ...(this.#alteration !== undefined ? { alteration: this.#alteration } : {}),
      ...(this.#applied !== undefined ? { applied: this.#applied.toJSON() } : {}),
    };
  }

  /**
   * Returns true when `other` has the same degree, quality, inversion,
   * alteration, and (recursively) applied target.
   */
  public equals(other: RomanNumeral): boolean {
    if (
      this.#degree !== other.#degree ||
      this.#quality !== other.#quality ||
      this.#inversion !== other.#inversion ||
      this.#alteration !== other.#alteration
    ) {
      return false;
    }
    if (this.#applied === undefined && other.#applied === undefined) {
      return true;
    }
    if (this.#applied === undefined || other.#applied === undefined) {
      return false;
    }
    return this.#applied.equals(other.#applied);
  }

  public get [Symbol.toStringTag](): string {
    return `RomanNumeral(${this.toString()})`;
  }
}

/**
 * @internal — private bridge for `key-roman.ts`. Constructs a
 * {@link RomanNumeral} from validated parts. Public callers should use
 * {@link RomanNumeral.parse}, {@link RomanNumeral.fromJSON}, or
 * {@link RomanNumeral.create} instead.
 */
export function unsafeRomanNumeralFromParts(
  degree: RomanNumeralDegree,
  quality: RomanNumeralQuality,
  inversion: RomanNumeralInversion,
  alteration: RomanNumeralAlteration | undefined,
  applied: RomanNumeral | undefined,
): RomanNumeral {
  return createRomanNumeral(degree, quality, inversion, alteration, applied);
}

/**
 * @internal — private helper for `key-roman.ts`. Returns a copy of a
 * Roman numeral with its applied target removed.
 */
export function stripApplied(rn: RomanNumeral): RomanNumeral {
  return createRomanNumeral(rn.degree, rn.quality, rn.inversion, rn.alteration, undefined);
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const SUPERSCRIPT_DIGITS = new Map<string, string>([
  ['⁰', '0'],
  ['¹', '1'],
  ['²', '2'],
  ['³', '3'],
  ['⁴', '4'],
  ['⁵', '5'],
  ['⁶', '6'],
  ['⁷', '7'],
  ['⁸', '8'],
  ['⁹', '9'],
  ['₀', '0'],
  ['₁', '1'],
  ['₂', '2'],
  ['₃', '3'],
  ['₄', '4'],
  ['₅', '5'],
  ['₆', '6'],
  ['₇', '7'],
  ['₈', '8'],
  ['₉', '9'],
]);

function normalizeForParse(input: string): string {
  let result = '';
  for (const character of input) {
    const ascii = SUPERSCRIPT_DIGITS.get(character);
    if (ascii !== undefined) {
      result += ascii;
    } else if (character === '♭') {
      result += 'b';
    } else if (character === '♯') {
      result += '#';
    } else if (character === '⁺') {
      result += '+';
    } else {
      result += character;
    }
  }
  return result;
}

function parseRomanNumeralString(raw: string): RomanNumeral {
  const slashIndex = raw.indexOf('/');
  if (slashIndex !== -1) {
    const head = raw.slice(0, slashIndex);
    const tail = raw.slice(slashIndex + 1);
    if (tail.length === 0) {
      throw new TypeError(`Roman numeral "${raw}" has a trailing slash with no applied target.`);
    }
    const target = parseRomanNumeralString(tail);
    const surface = parseSurface(head);
    return createRomanNumeral(
      surface.degree,
      surface.quality,
      surface.inversion,
      surface.alteration,
      target,
    );
  }
  const surface = parseSurface(raw);
  return createRomanNumeral(
    surface.degree,
    surface.quality,
    surface.inversion,
    surface.alteration,
    undefined,
  );
}

type Surface = {
  degree: RomanNumeralDegree;
  quality: RomanNumeralQuality;
  inversion: RomanNumeralInversion;
  alteration: RomanNumeralAlteration | undefined;
};

function parseSurface(raw: string): Surface {
  const normalized = normalizeForParse(raw);
  let cursor = 0;

  let alteration: RomanNumeralAlteration | undefined;
  if (normalized[cursor] === 'b') {
    alteration = 'flat';
    cursor += 1;
  } else if (normalized[cursor] === '#') {
    alteration = 'sharp';
    cursor += 1;
  }

  const letters = readRomanLetters(normalized, cursor);
  if (letters === null) {
    throw new TypeError(`Roman numeral "${raw}" has no recognizable degree letters.`);
  }
  cursor = letters.end;

  let qualityMarker: 'diminished' | 'augmented' | undefined;
  if (normalized[cursor] === '°' || normalized[cursor] === 'o') {
    qualityMarker = 'diminished';
    cursor += 1;
  } else if (normalized[cursor] === '+') {
    qualityMarker = 'augmented';
    cursor += 1;
  }

  const figureSlice = normalized.slice(cursor).replaceAll(/\s+/gu, '').replaceAll('/', '');
  const inversion = parseInversionFigures(figureSlice);

  validateQualityCombination(letters.uppercase, qualityMarker, raw);
  const baseQuality: RomanNumeralQuality = letters.uppercase ? 'major' : 'minor';
  const quality: RomanNumeralQuality = qualityMarker !== undefined ? qualityMarker : baseQuality;

  return {
    degree: letters.degree,
    quality,
    inversion,
    alteration,
  };
}

function validateQualityCombination(
  uppercase: boolean,
  marker: 'diminished' | 'augmented' | undefined,
  raw: string,
): void {
  if (uppercase && marker === 'diminished') {
    throw new TypeError(
      `Roman numeral "${raw}" uses an uppercase letter (major/augmented) with the ` +
        `diminished marker °/o; choose one quality convention.`,
    );
  }
  if (!uppercase && marker === 'augmented') {
    throw new TypeError(
      `Roman numeral "${raw}" uses a lowercase letter (minor/diminished) with the ` +
        `augmented marker +; choose one quality convention.`,
    );
  }
}

function readRomanLetters(
  input: string,
  start: number,
): { degree: RomanNumeralDegree; uppercase: boolean; end: number } | null {
  // Longest-match-first to disambiguate III/II/I, VII/VI/V, etc.
  const candidates: Array<readonly [string, RomanNumeralDegree]> = [
    ['VII', 7],
    ['vii', 7],
    ['III', 3],
    ['iii', 3],
    ['VI', 6],
    ['vi', 6],
    ['IV', 4],
    ['iv', 4],
    ['II', 2],
    ['ii', 2],
    ['V', 5],
    ['v', 5],
    ['I', 1],
    ['i', 1],
  ];
  for (const [letters, degree] of candidates) {
    if (input.startsWith(letters, start)) {
      const firstChar = letters[0]!;
      const uppercase =
        firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
      return { degree, uppercase, end: start + letters.length };
    }
  }
  return null;
}

function parseInversionFigures(raw: string): RomanNumeralInversion {
  switch (raw) {
    case '':
      return '5/3';
    case '6':
      return '6';
    case '64':
      return '6/4';
    case '7':
      return '7';
    case '65':
      return '6/5';
    case '43':
      return '4/3';
    case '42':
      return '4/2';
    default:
      throw new TypeError(
        `Roman numeral has an unrecognized inversion figure "${raw}"; supported figures are ` +
          `(empty for root-position triad), 6, 64, 7, 65, 43, 42.`,
      );
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderRomanNumeral(rn: RomanNumeral): string {
  const head = renderSurface(rn);
  const applied = rn.applied;
  if (applied === undefined) {
    return head;
  }
  return `${head}/${renderRomanNumeral(applied)}`;
}

function renderSurface(rn: RomanNumeral): string {
  return `${renderAlteration(rn.alteration)}${renderLetters(rn.degree, rn.quality)}${renderQualityMarker(rn.quality)}${renderInversion(rn.inversion)}`;
}

function renderAlteration(alteration: RomanNumeralAlteration | undefined): string {
  if (alteration === 'flat') return '♭';
  if (alteration === 'sharp') return '♯';
  return '';
}

function renderLetters(degree: RomanNumeralDegree, quality: RomanNumeralQuality): string {
  const isUppercase = quality === 'major' || quality === 'augmented';
  const lookup: Record<RomanNumeralDegree, string> = {
    1: isUppercase ? 'I' : 'i',
    2: isUppercase ? 'II' : 'ii',
    3: isUppercase ? 'III' : 'iii',
    4: isUppercase ? 'IV' : 'iv',
    5: isUppercase ? 'V' : 'v',
    6: isUppercase ? 'VI' : 'vi',
    7: isUppercase ? 'VII' : 'vii',
  };
  return lookup[degree];
}

function renderQualityMarker(quality: RomanNumeralQuality): string {
  if (quality === 'diminished') return '°';
  if (quality === 'augmented') return '⁺';
  return '';
}

const INVERSION_RENDERINGS: Readonly<Record<RomanNumeralInversion, string>> = {
  '5/3': '',
  '6': '⁶',
  '6/4': '⁶₄',
  '7': '⁷',
  '6/5': '⁶₅',
  '4/3': '⁴₃',
  '4/2': '⁴₂',
};

function renderInversion(inversion: RomanNumeralInversion): string {
  return INVERSION_RENDERINGS[inversion];
}
