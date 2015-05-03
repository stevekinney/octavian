const chai = require('chai');
const assert = chai.assert;

const Note = require('../lib/note');

describe('Note', function () {

  it('should parse a note argument', function () {
    let note = new Note('A4');
    assert.equal(note.letter, 'A');
    assert.equal(note.modifier, null);
    assert.equal(note.octave, 4);
  });

  it('should concatentate its note signature', function () {
    let note = new Note('Ab5');
    assert.equal(note.signature, 'Ab5');
  });

  it('should normalize the note signature', function () {
    let note = new Note('B#4');
    assert.equal(note.signature, 'C4');
  });

  it('should parse a new note signature', function () {
    let note = new Note('Ab5');
    note.signature = 'C#6';
    assert.equal(note.letter, 'C');
    assert.equal(note.modifier, '#');
    assert.equal(note.octave, 6);
  });

  it('should align a note to a piano key', function () {
    assert.equal(new Note('A0').pianoKey, 1);
    assert.equal(new Note('C4').pianoKey, 40);
    assert.equal(new Note('A4').pianoKey, 49);
    assert.equal(new Note('Eb5').pianoKey, 55);
    assert.equal(new Note('F#6').pianoKey, 70);
    assert.equal(new Note('C8').pianoKey, 88);
  });

  it('should assign a frequency based on the piano key', function () {
    assert.equal(new Note('A4').frequency, 440);
    assert.equal(new Note('F#6').frequency, 1479.98);
  });

  it('should not allow to create a note that is out of range', function () {
    assert.throw(function () {
      new Note('C0');
    }, /Out of Range/i);
    assert.throw(function () {
      new Note('D9');
    }, /Out of Range/i);
  });

});