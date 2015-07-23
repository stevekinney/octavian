import Note from '../note';
import addAdditionalNotes from './add-additional-notes';

class Chord {
  constructor(signature = 'A4', mode = undefined) {
    this.root = new Note(signature);
    this.mode = mode;
    this.notes = [this.root];

    if (mode) { addAdditionalNotes.call(this); }
  }

  get signatures() {
    return this.notes.map(n => n.signature);
  }

  get pianoKeys() {
    return this.notes.map(n => n.pianoKey);
  }

  get frequencies() {
    return this.notes.map(n => n.frequency);
  }

  addInterval(i) {
    this.notes.push(this.root.interval(i));
    return this;
  }
}

export default Chord;
