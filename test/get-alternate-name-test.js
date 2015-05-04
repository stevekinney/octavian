const chai = require('chai');
const assert = chai.assert;

const getAlternateNames = require('../lib/note/get-alternate-name');

describe('getAlternateNames', function () {

  it('should return null for notes with not alternate names', function () {
    assert.equal(getAlternateNames('C4'), null);
  });

  it('should return the correct alternate name', function () {
    assert.equal(getAlternateNames('F#4'), 'Gb4');
    assert.equal(getAlternateNames('Gb4'), 'F#4');
  });

});