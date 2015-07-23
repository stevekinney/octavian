const modes = {
  major: ['majorThird', 'perfectFifth'],
  minor: ['minorThird', 'perfectFifth']
};

export default function () {
  if (!modes[this.mode]) {
    throw new Error(`Invalid mode, try: ${Object.keys(modes).join(', ')}`);
  }

  const notes = modes[this.mode].map(i => this.root[i]());
  this.notes = this.notes.concat(notes);
}
