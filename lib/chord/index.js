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

  /**
   * Generates a random inversion of the chord, i.e. for a triad the inversion
   * is -2, -1, 0, 1 or 2 steps for a four tone chord it ranges
   * from -3 to 3 etc
   *
   */
  randomInversion() {
    const max = this.notes.length - 1;
    const randomSteps = Math.floor(Math.random() * (2 * max + 1) - max);
    return this.inversion(randomSteps);
  }

  /**
   * Creates an inversion of the chord dictated by the number of steps. One
   * step will only invert the lowest note (first inversion). Two steps will
   * invert the bottom two notes etc. It's also possible to supply a negative
   * number, this will start the inversion from the top (highest) note.
   *
   * @param steps which inversion, 1 = first, 2 = second, etc
   */
  inversion(steps) {
    const length = this.notes.length - 1;

    for(let counter = 0; counter < Math.abs(steps) && counter < length; ++counter) {
      const index = steps > 0 ? counter : length - counter;
      this.notes[index] = this.notes[index].interval(Math.sign(steps) * 12);
    }

    return this;
  }

  addInterval(i) {
    this.notes.push(this.root.interval(i));
    return this;
  }
}

export default Chord;
