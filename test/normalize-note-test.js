const chai = require('chai');
const assert = chai.assert;

const normalizeNote = require('../lib/note/normalize-note');

describe('normalizeNote', function () {

  it('should returns a valid natural note', function () {
    assert.deepEqual(normalizeNote('A'), { letter: 'A', modifier: null });
    assert.deepEqual(normalizeNote('B'), { letter: 'B', modifier: null });
    assert.deepEqual(normalizeNote('C'), { letter: 'C', modifier: null });
    assert.deepEqual(normalizeNote('D'), { letter: 'D', modifier: null });
    assert.deepEqual(normalizeNote('E'), { letter: 'E', modifier: null });
    assert.deepEqual(normalizeNote('F'), { letter: 'F', modifier: null });
    assert.deepEqual(normalizeNote('G'), { letter: 'G', modifier: null });
  });

  it('should take a lowercase note', function () {
    assert.deepEqual(normalizeNote('a'), { letter: 'A', modifier: null });
  });

  it('should return a valid sharp note', function () {
    assert.deepEqual(normalizeNote('A#'), { letter: 'A', modifier: '#' });
  });

  it('should return a valid flat note', function () {
    assert.deepEqual(normalizeNote('Ab'), { letter: 'A', modifier: 'b' });
  });

  it('should correct flat notes that do not exist', function () {
    assert.deepEqual(normalizeNote('Cb'), { letter: 'B', modifier: null });
    assert.deepEqual(normalizeNote('Fb'), { letter: 'E', modifier: null });
  });

  it('should correct sharp notes that do not exist', function () {
    assert.deepEqual(normalizeNote('B#'), { letter: 'C', modifier: null });
    assert.deepEqual(normalizeNote('E#'), { letter: 'F', modifier: null });
  });

  it('should throw on an invalid note letter', function () {
    assert.throw(normalizeNote.bind(null, 'H'), /Invalid note letter/);
  });

  it('should throw on an invalid modifier', function () {
    assert.throw(normalizeNote.bind(null, 'Cx'), /Invalid modifier/);
  });

});