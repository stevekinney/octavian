const C0 = 16.35;

function octavian(frequency, octave, base) {
  'use strict';

  octave = octave || 0;
  base = base || C0;

  var nextOctave = base * 2;

  if (frequency > nextOctave) {
    return octavian(frequency, ++octave, nextOctave);
  } else {
    return octave;
  }
}

module.exports = octavian;