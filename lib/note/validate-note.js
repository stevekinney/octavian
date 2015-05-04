import { pianoKeys } from './piano-keys';

const validNotes = Object.keys(pianoKeys);

export default function validateNote(signature) {
  if (validNotes.indexOf(signature) === -1) {
    throw new Error('Out of range');
  }
}