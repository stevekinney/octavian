import modes from './modes';

export default function () {
  const mode = this.mode;

  if (!modes[mode]) {
    throw new Error(`Invalid mode, try: ${Object.keys(modes).join(', ')}`);
  }

  const notes = modes[mode].map(i => this.root[i]());
  this.notes = this.notes.concat(notes);
}
