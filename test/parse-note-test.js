const chai = require('chai');
const assert = chai.assert;

const parseNote = require('../lib/note/parse-note');

describe('parseNote', function () {

  it('should parse the note letter', function () {
    const note = parseNote('A4');
    assert.equal(note.letter, 'A');
  });

  it('should parse the note modifier', function () {
    assert.equal(parseNote('Ab4').modifier, 'b');
    assert.equal(parseNote('A#4').modifier, '#');
  });

  it('should parse an octave as an integer', function () {
    assert.equal(parseNote('A4').octave, 4);
  });

  it('should set the modifier to null if missing', function () {
    assert.equal(parseNote('A4').modifier, null);
  });

  it('should adjust non-existent flats', function () {
    let note = parseNote('Cb4');
    assert.equal(note.letter, 'B');
    assert.equal(note.modifier, null);
  });

  it('should adjust non-existent sharps', function () {
    let note = parseNote('B#4');
    assert.equal(note.letter, 'C');
    assert.equal(note.modifier, null);
  });

  it('should throw on a incorrectly formatted note', function () {
    assert.throw(parseNote.bind(null, 'invalid'), /Invalid note format/);
    assert.throw(parseNote.bind(null, 'Z4'), /Invalid note format/);
  });

  it('should validate a correctly formatted note', function () {
    ['A4', 'Ab4', 'A#4'].forEach(function (note) {
      assert.doesNotThrow(parseNote.bind(null, note));
    });
  });

});