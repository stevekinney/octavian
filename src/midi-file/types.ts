/**
 * Domain types for Standard MIDI File (SMF) documents.
 */

// ---------------------------------------------------------------------------
// MIDI event types
// ---------------------------------------------------------------------------

/**
 * A raw MIDI note-on event, parsed from an SMF track.
 */
export type MidiNoteOnEvent = {
  /** Discriminant. */
  readonly type: 'noteOn';
  /** Delta time in ticks from the previous event. */
  readonly deltaTicks: number;
  /** MIDI channel (0-indexed, 0..15). */
  readonly channel: number;
  /** MIDI note number (0..127). */
  readonly noteNumber: number;
  /** Velocity (0..127). A velocity of 0 is equivalent to note-off. */
  readonly velocity: number;
};

/**
 * A raw MIDI note-off event, parsed from an SMF track.
 */
export type MidiNoteOffEvent = {
  /** Discriminant. */
  readonly type: 'noteOff';
  /** Delta time in ticks from the previous event. */
  readonly deltaTicks: number;
  /** MIDI channel (0-indexed, 0..15). */
  readonly channel: number;
  /** MIDI note number (0..127). */
  readonly noteNumber: number;
  /** Velocity (0..127). */
  readonly velocity: number;
};

/**
 * A MIDI tempo meta event (FF 51 03 tt tt tt).
 */
export type MidiTempoEvent = {
  /** Discriminant. */
  readonly type: 'tempo';
  /** Delta time in ticks from the previous event. */
  readonly deltaTicks: number;
  /** Microseconds per quarter note. */
  readonly microsecondsPerQuarter: number;
};

/**
 * A MIDI time signature meta event (FF 58 04 nn dd cc bb).
 */
export type MidiTimeSignatureEvent = {
  /** Discriminant. */
  readonly type: 'timeSignature';
  /** Delta time in ticks from the previous event. */
  readonly deltaTicks: number;
  /** Numerator of the time signature. */
  readonly numerator: number;
  /** Denominator of the time signature (2^dd). */
  readonly denominator: number;
  /** MIDI clocks per metronome click. */
  readonly clocksPerClick: number;
  /** 32nd notes per MIDI quarter note. */
  readonly thirtySecondNotesPerQuarter: number;
};

/**
 * End-of-track meta event (FF 2F 00).
 */
export type MidiEndOfTrackEvent = {
  /** Discriminant. */
  readonly type: 'endOfTrack';
  /** Delta time in ticks from the previous event. */
  readonly deltaTicks: number;
};

/**
 * Any other meta event (unknown type).
 */
export type MidiUnknownMetaEvent = {
  /** Discriminant. */
  readonly type: 'unknownMeta';
  /** Delta time in ticks. */
  readonly deltaTicks: number;
  /** The raw meta type byte. */
  readonly metaType: number;
  /** The raw data bytes. */
  readonly data: Uint8Array;
};

/**
 * A union of all parsed MIDI track events.
 */
export type MidiTrackEvent =
  | MidiNoteOnEvent
  | MidiNoteOffEvent
  | MidiTempoEvent
  | MidiTimeSignatureEvent
  | MidiEndOfTrackEvent
  | MidiUnknownMetaEvent;

// ---------------------------------------------------------------------------
// MIDI file document
// ---------------------------------------------------------------------------

/**
 * A parsed Standard MIDI File document.
 */
export type MidiFileDocument = {
  /**
   * SMF format type: 0 = single track, 1 = multi-track synchronous.
   */
  readonly format: 0 | 1;
  /**
   * Ticks per quarter note (the `division` field in the SMF header).
   */
  readonly ticksPerQuarter: number;
  /**
   * The parsed tracks, each an array of timed events.
   */
  readonly tracks: readonly (readonly MidiTrackEvent[])[];
};

// ---------------------------------------------------------------------------
// Sequence-to-MIDI options
// ---------------------------------------------------------------------------

/**
 * Options for {@link sequenceToMidiFile}.
 */
export type SequenceToMidiOptions = {
  /**
   * Ticks per quarter note for the output file.
   * @defaultValue 480
   */
  readonly ticksPerQuarter?: number;
  /**
   * MIDI channel to use for note events (0-indexed, 0..15).
   * @defaultValue 0
   */
  readonly channel?: number;
};

/**
 * Options for {@link midiFileToSequence}.
 */
export type MidiFileToSequenceOptions = {
  /**
   * Default tempo in BPM if no tempo meta event is present.
   * @defaultValue 120
   */
  readonly defaultTempo?: number;
};
