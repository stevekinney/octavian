const modes = Object.defineProperties({
  major: ['majorThird', 'perfectFifth'],
  majorSixth: ['majorThird', 'perfectFifth', 'majorSixth'],
  majorSeventh: ['majorThird', 'perfectFifth', 'majorSeventh'],
  majorSeventhFlatFive: ['majorThird', 'diminishedFifth', 'majorSeventh'],
  majorSeventhSharpFive: ['majorThird', 'minorSixth', 'majorSeventh'],
  minor: ['minorThird', 'perfectFifth'],
  minorSixth: ['minorThird', 'perfectFifth', 'majorSixth'],
  minorSeventh: ['minorThird', 'perfectFifth', 'minorSeventh'],
  minorMajor: ['minorThird', 'perfectFifth', 'minorSeventh'],
  dominantSeventh: ['majorThird', 'perfectFifth', 'minorSeventh'],
  diminished: ['minorThird', 'diminishedFifth'],
  diminishedSeventh: ['minorThird', 'diminishedFifth', 'majorSixth'],
  halfDimished: ['minorThird', 'diminishedFifth', 'minorSeventh'] }, {
  maj: {
    get: function () { return this.major; },
    enumerable: true
  },
  '6': {
    get: function () { return this.majorSixth; },
    enumerable: true
  },
  maj6: {
    get: function () { return this.majorSixth; },
    enumerable: true
  },
  '7': {
    get: function () { return this.majorSeventh; },
    enumerable: true
  },
  maj7: {
    get: function () { return this.majorSeventh; },
    enumerable: true
  },
  maj7b5: {
    get: function () { return this.majorSeventhFlatFive; },
    enumerable: true
  },
  'maj7#5': {
    get: function () { return this.majorSeventhSharpFive; },
    enumerable: true
  },
  min: {
    get: function () { return this.minor; },
    enumerable: true
  },
  m: {
    get: function () { return this.minor; },
    enumerable: true
  },
  min6: {
    get: function () { return this.minorSixth; },
    enumerable: true
  },
  m6: {
    get: function () { return this.minorSixth; },
    enumerable: true
  },
  min7: {
    get: function () { return this.minorSeventh; },
    enumerable: true
  },
  m7: {
    get: function () { return this.minorSeventh; },
    enumerable: true
  },
  'm#7': {
    get: function () { return this.minorMajor; },
    enumerable: true
  },
  'min#7': {
    get: function () { return this.minorMajor; },
    enumerable: true
  },
  'm(maj7)': {
    get: function () { return this.minorMajor; },
    enumerable: true
  },
  dom7: {
    get: function () { return this.dominantSeventh; },
    enumerable: true
  },
  dim: {
    get: function () { return this.diminished; },
    enumerable: true
  },
  dim7: {
    get: function () { return this.diminishedSeventh; },
    enumerable: true
  },
  m7b5: {
    get: function () { return this.halfDiminshed; },
    enumerable: true
  }
});

export default Object.freeze(modes);
