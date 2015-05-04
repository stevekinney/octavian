import { pianoKeys } from './piano-keys';

const validNotes = Object.keys(pianoKeys);

export default function validateNote(signature) {
  if (!validNotes.includes(signature)) { throw new Error('Out of range'); }
}