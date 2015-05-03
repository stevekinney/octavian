import parseNote from './parse-note';
import { pianoKeys, frequencies } from './piano-keys';

class Note {
  constructor(note) {
    const parsedNote = parseNote(note);
    Object.keys(parsedNote).forEach(key => this[key] = parsedNote[key]);
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
}

export default Note;