import normalizeNote from './normalize-note';

export default function (note) {
  const noteSegments = note.match(/([A-Ga-g])([#b]{0,1})([0-8])/);

  if (!noteSegments) { throw new Error(`Invalid note format: ${note}.`); }

  const noteWithModifier = noteSegments.slice(1,3).join('');

  const {letter, modifier} = normalizeNote(noteWithModifier);
  const octave = noteSegments[3];

  return {
    letter: letter,
    modifier: modifier || null,
    octave: octave
  };
}