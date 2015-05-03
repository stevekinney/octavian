const alternateNames = {
  'Ab': 'G#',
  'A#': 'Bb',
  'Bb': 'A#',
  'C#': 'Db',
  'Db': 'C#',
  'D#': 'Eb',
  'Eb': 'D#',
  'F#': 'Gb',
  'Gb': 'F#',
  'G#': 'Ab'
};

export default function (signature) {
  const [note, octave] = signature.match(/([A-G][b#]{0,1})(\d)/).slice(1,3);
  if (!alternateNames[note]) { return null; }
  return alternateNames[note] + octave;
}