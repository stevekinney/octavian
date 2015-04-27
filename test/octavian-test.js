const test = require('./');
const octavian = require('../');

test('It can figure out that A1 is in the first octave', function (t) {
  t.equal(octavian(55), 1);
  t.end();
});

test('It can figure out that A2 is in the second octave', function (t) {
  t.equal(octavian(110), 2);
  t.end();
});

test('It can figure out that A3 is in the third octave', function (t) {
  t.equal(octavian(220), 3);
  t.end();
});

test('It can figure out that A4 is in the fourth octave', function (t) {
  t.equal(octavian(440), 4);
  t.end();
});

test('It can figure out that A5 is in the fifth octave', function (t) {
  t.equal(octavian(880), 5);
  t.end();
});