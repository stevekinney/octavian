/**
 * Discriminated-union types for MIDI messages.
 *
 * Each variant carries the raw `channel` (0..15) and type-specific fields.
 * The `type` discriminant matches the MIDI status byte's high nibble:
 *   - `'noteOff'`         0x80
 *   - `'noteOn'`          0x90 (velocity=0 normalises to noteOff)
 *   - `'controlChange'`   0xB0
 *   - `'programChange'`   0xC0
 *   - `'pitchBend'`       0xE0
 */

// ---------------------------------------------------------------------------
// Individual message variants
// ---------------------------------------------------------------------------

/**
 * A MIDI Note-Off message (status nibble 0x80), or a Note-On with velocity 0
 * that has been normalised to note-off per the MIDI specification.
 */
export type NoteOffMessage = {
  /** Discriminant. */
  readonly type: 'noteOff';
  /** MIDI channel, 0..15. */
  readonly channel: number;
  /** MIDI note number, 0..127. */
  readonly note: number;
  /** Release velocity, 0..127. */
  readonly velocity: number;
};

/**
 * A MIDI Note-On message (status nibble 0x90) with a non-zero velocity.
 * A Note-On with velocity 0 is parsed as {@link NoteOffMessage}.
 */
export type NoteOnMessage = {
  /** Discriminant. */
  readonly type: 'noteOn';
  /** MIDI channel, 0..15. */
  readonly channel: number;
  /** MIDI note number, 0..127. */
  readonly note: number;
  /** Attack velocity, 1..127. */
  readonly velocity: number;
};

/**
 * A MIDI Control Change message (status nibble 0xB0).
 * CC 64 is the sustain pedal: value >= 64 = on, value < 64 = off.
 */
export type ControlChangeMessage = {
  /** Discriminant. */
  readonly type: 'controlChange';
  /** MIDI channel, 0..15. */
  readonly channel: number;
  /** Controller number, 0..127. */
  readonly controller: number;
  /** Controller value, 0..127. */
  readonly value: number;
};

/**
 * A MIDI Program Change message (status nibble 0xC0).
 */
export type ProgramChangeMessage = {
  /** Discriminant. */
  readonly type: 'programChange';
  /** MIDI channel, 0..15. */
  readonly channel: number;
  /** Program number, 0..127. */
  readonly program: number;
};

/**
 * A MIDI Pitch Bend message (status nibble 0xE0).
 * The 14-bit value is transmitted as two 7-bit bytes (LSB first, MSB second)
 * and ranges 0..16383, centred at 8192 (no bend).
 */
export type PitchBendMessage = {
  /** Discriminant. */
  readonly type: 'pitchBend';
  /** MIDI channel, 0..15. */
  readonly channel: number;
  /**
   * The raw unsigned 14-bit bend value, 0..16383. Centre (no bend) = 8192.
   * Full bend down = 0; full bend up = 16383.
   */
  readonly value: number;
};

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

/**
 * A parsed MIDI message — one of the five common channel-voice message types.
 * Discriminate on the `type` field.
 */
export type MidiMessage =
  | NoteOnMessage
  | NoteOffMessage
  | ControlChangeMessage
  | ProgramChangeMessage
  | PitchBendMessage;

// ---------------------------------------------------------------------------
// Sustain CC constant
// ---------------------------------------------------------------------------

/** MIDI controller number for the sustain pedal (damper). */
export const SUSTAIN_CONTROLLER = 64 as const;

/** Sustain pedal is on when its value is >= this threshold. */
export const SUSTAIN_THRESHOLD = 64 as const;
