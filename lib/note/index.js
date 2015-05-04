import parseNote from './parse-note';
import getAlternateName from './get-alternate-name';
import getNoteFromPianoKey from './get-note-from-piano-key';
import { pianoKeys, frequencies } from './piano-keys';
import validateNote from './validate-note';

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

  interval(steps) {
    return Note.fromPianoKey(this.pianoKey + steps);
  }

  downOctave() { return this.interval(-12); }
  minorSecond() { return this.interval(1); }
  majorSecond() { return this.interval(2); }
  minorThird() { return this.interval(3); }
  majorThird() { return this.interval(4); }
  perfectFourth() { return this.interval(5); }
  diminishedFifth() { return this.interval(6); }
  perfectFifth() { return this.interval(7); }
  minorSixth() { return this.interval(8); }
  majorSixth() { return this.interval(9); }
  minorSeventh() { return this.interval(10); }
  majorSeventh() { return this.interval(11); }
  perfectOctave() { return this.interval(12); }

  augmentedFourth() { return this.diminishedFifth(); }

  third() { return this.majorThird(); }
  fifth() { return this.perfectFifth(); }

  static fromPianoKey(pianoKey) {
    const note = getNoteFromPianoKey(pianoKey);
    return new this(note);
  }
}

export default Note;