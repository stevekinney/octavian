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

  it('should support adding a note by interval steps', function () {
    const chord = new Chord('C4');
    chord.addInterval(4);
    assert.equal(chord.notes.length, 2);
    assert.equal(chord.signatures[1], 'E4');
  });

  it('should should support adding an interval by name', function () {
    const chord = new Chord('C4');
    chord.addInterval('majorThird');
    assert.equal(chord.notes.length, 2);
    assert.equal(chord.signatures[1], 'E4');
  });

  describe('chord inversions', function(){
    it('should create the 1st inversion of a triad', function(){
      const chord = new Chord('C4', 'major');
      chord.inversion(1);
      assert.deepEqual(chord.signatures, ['C5', 'E4', 'G4']);
    });

    it('should create the 2nd inversion of a triad', function(){
      const chord = new Chord('C4', 'major');
      chord.inversion(2);
      assert.deepEqual(chord.signatures, ['C5', 'E5', 'G4']);
    });

    it('should not transpose the 3rd step of a triad', function(){
      const chord = new Chord('C4', 'major');
      chord.inversion(3);
      assert.deepEqual(chord.signatures, ['C5', 'E5', 'G4']);
    });

    it('should transpose the top note for a provided negative value', function(){
      const chord = new Chord('C4', 'major');
      chord.inversion(-1);
      assert.deepEqual(chord.signatures, ['C4', 'E4', 'G3']);
    });

    it('should transpose the top two notes for a provided negative value', function(){
      const chord = new Chord('C4', 'major');
      chord.inversion(-2);
      assert.deepEqual(chord.signatures, ['C4', 'E3', 'G3']);
    });

    it('should not transpose the 3rd step of a triad for a negative value', function(){
      const chord = new Chord('C4', 'major');
      chord.inversion(-3);
      assert.deepEqual(chord.signatures, ['C4', 'E3', 'G3']);
    });

    it('should generate a random inversion', function() {
      const actualValues = [];
      const expectedValues = [
        ['C4', 'E3', 'G3'],
        ['C4', 'E4', 'G3'],
        ['C4', 'E4', 'G4'],
        ['C5', 'E4', 'G4'],
        ['C5', 'E5', 'G4']
      ];

      // test random value 100 times and assume result will be representative
      for(let i = 0; i < 100; ++i){
        actualValues.push(
          (new Chord('C4', 'major')).randomInversion().signatures
        );
      }

      assert.isTrue(actualValues.every(actual => expectedValues.some(expected =>
        JSON.stringify(expected) === JSON.stringify(actual)
      )));
    });
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

    it('should work with maj alias', function () {
      const chord = new Chord('C4', 'maj');
      assert.deepEqual(chord.signatures, ['C4', 'E4', 'G4']);
    });
  });

});
