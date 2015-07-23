import parseNote from './parse-note';
import getAlternateName from './get-alternate-name';
import getNoteFromPianoKey from './get-note-from-piano-key';
import { pianoKeys, frequencies } from './piano-keys';
import validateNote from './validate-note';
import intervals from './intervals';
import Chord from '../chord';

class Note {
  constructor(note) {
    const parsedNote = parseNote(note);
    Object.keys(parsedNote).forEach(key => this[key] = parsedNote[key]);
    validateNote(this.signature);
  }

  get signature() {
    return `${this.letter}${this.modifier || ''}${this.octave}`;
  }

  set signature(note) {
    this.constructor(note);
    return this.signature;
  }

  get pianoKey() {
    return pianoKeys[this.signature];
  }

  get frequency() {
    return frequencies[this.pianoKey];
  }

  get alternateName() {
    return getAlternateName(this.signature);
  }

  interval(i) {
    if (typeof i === 'number') { return Note.fromPianoKey(this.pianoKey + i); }

    const validIntervals = Object.keys(intervals);
    if (validIntervals.indexOf(i) === -1) {
      throw new Error(`${i} is an invalid interval,
                       try: ${validIntervals.join(', ')}`);
    }

    return this[i]();
  }

  toChord(mode) {
    return new Chord(this.signature, mode);
  }

  static fromPianoKey(pianoKey) {
    const note = getNoteFromPianoKey(pianoKey);
    return new this(note);
  }
}

for (let interval of Object.keys(intervals)) {
  Note.prototype[interval] = function () {
    return this.interval(intervals[interval]);
  };
}

export default Note;
