import { equal, match } from 'node:assert/strict';
import { createOctave, Note } from 'octavian';

const octave4 = createOctave(4);

if (!('bun' in process.versions)) {
  const url = import.meta.resolve('octavian');
  match(url, /dist\/browser\/index\.js$/);
}

equal(new Note('A', octave4).frequency, 440);
equal(new Note('A', octave4).midi, 69);
equal(new Note('C', octave4).midi, 60);
