const intervals = Object.defineProperties({
  downOctave: -12,
  minorSecond: 1,
  majorSecond: 2,
  minorThird: 3,
  majorThird: 4,
  perfectFourth: 5,
  diminishedFifth: 6,
  perfectFifth: 7,
  minorSixth: 8,
  majorSixth: 9,
  minorSeventh: 10,
  majorSeventh: 11,
  perfectOctave: 12
}, {
  augmentedFourth: {
    get: function () { return this.diminishedFifth; },
    enumerable: true
  },
  third: {
    get: function () { return this.majorThird; },
    enumerable: true
  },
  fifth: {
    get: function () { return this.perfectFifth; },
    enumerable: true
  }
});

export default Object.freeze(intervals);
