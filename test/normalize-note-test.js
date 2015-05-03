const chai = require('chai');
const assert = chai.assert;

const normalizeNote = require('../lib/normalize-note.js');

describe('normalizeNote', function () {

  it('should returns a valid natural note', function () {
    assert.equal(normalizeNote('A'), 'A');
    assert.equal(normalizeNote('B'), 'B');
    assert.equal(normalizeNote('C'), 'C');
    assert.equal(normalizeNote('D'), 'D');
    assert.equal(normalizeNote('E'), 'E');
    assert.equal(normalizeNote('F'), 'F');
    assert.equal(normalizeNote('G'), 'G');
  });

  it('should take a lowercase note', function () {
    assert.equal('A', normalizeNote('a'));
  });

  it('should return a valid sharp note', function () {
    assert.equal(normalizeNote('A#'), 'A#');
  });

  it('should return a valid flat note', function () {
    assert.equal(normalizeNote('Ab'), 'Ab');
  });

  it('should correct flat notes that do not exist', function () {
    assert.equal(normalizeNote('Cb'), 'B');
    assert.equal(normalizeNote('Fb'), 'E');
  });

  it('should correct sharp notes that do not exist', function () {
    assert.equal(normalizeNote('B#'), 'C');
    assert.equal(normalizeNote('E#'), 'F');
  });

  it('should throw on an invalid note letter', function () {
    assert.throw(normalizeNote.bind(null, 'H'), /Invalid note letter/);
  });

  it('should throw on an invalid modifier', function () {
    assert.throw(normalizeNote.bind(null, 'Cx'), /Invalid modifier/);
  });

});