class Note {
  constructor(options) {
    if (typeof options === 'string') { this.note = options; }
    if (typeof options === 'object') {
      Object.keys(options).forEach(option => this[option] = options[option]);
    }
  }
}

export default Note;