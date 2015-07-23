const chai = require('chai');
const assert = chai.assert;

import Chord from '../lib/chord';

describe('Chord', function () {

  it('should have an array of notes', function () {
    const chord = new Chord('C4');
    assert.isArray(chord.notes);
  });

  it('should contain the root note', function () {
    const chord = new Chord('C4');
    assert.equal(chord.root.signature, 'C4');
  });

  it('should have a method that returns the signatures as strings', function () {
    const chord = new Chord('C4');
    assert.deepEqual(chord.signatures, ['C4']);
  });

  it('should have a method that returns the piano keys as integers', function () {
    const chord = new Chord('C4');
    assert.deepEqual(chord.pianoKeys, [40]);
  });

  it('should should have a method that returns the frequencies as integers', function () {
    const chord = new Chord('C4');
    assert.deepEqual(chord.frequencies, [261.626]);
  });

  it('should throw if you pass an invalid mode', function () {
    assert.throws(function () {
      const chord = new Chord('C4', 'invalidMode');
    }, /invalid mode/gi);
  });

  describe('Chord Formations', function () {
    it('should create a major chord', function () {
      const chord = new Chord('C4', 'major');
      assert.deepEqual(chord.signatures, ['C4', 'E4', 'G4']);
    });

    it('should create a minor chord', function () {
      const chord = new Chord('C4', 'minor');
      assert.deepEqual(chord.signatures, ['C4', 'D#4', 'G4']);
    });
  });

});
