const chai = require('chai');
const assert = chai.assert;

const Note = require('../lib/note');

describe('Note', function () {

  it('should construct an object', function () {
    assert(new Note());
  });

  it('should take a note argument', function () {
    let note = new Note('A4');
    assert.equal(note.note, 'A4');
  });

  it('should take an object of arguments with a note property', function () {
    let note = new Note({ note: 'A4' });
    assert.equal(note.note, 'A4');
  });

});