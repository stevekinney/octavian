'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _interopRequireDefault = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _parseNote = require('./parse-note');

var _parseNote2 = _interopRequireDefault(_parseNote);

var _getAlternateName = require('./get-alternate-name');

var _getAlternateName2 = _interopRequireDefault(_getAlternateName);

var _getNoteFromPianoKey = require('./get-note-from-piano-key');

var _getNoteFromPianoKey2 = _interopRequireDefault(_getNoteFromPianoKey);

var _pianoKeys$frequencies = require('./piano-keys');

var _validateNote = require('./validate-note');

var _validateNote2 = _interopRequireDefault(_validateNote);

var Note = (function () {
  function Note(note) {
    var _this = this;

    _classCallCheck(this, Note);

    var parsedNote = _parseNote2['default'](note);
    Object.keys(parsedNote).forEach(function (key) {
      return _this[key] = parsedNote[key];
    });
    _validateNote2['default'](this.signature);
  }

  _createClass(Note, [{
    key: 'signature',
    get: function () {
      return '' + this.letter + '' + (this.modifier || '') + '' + this.octave;
    },
    set: function (note) {
      this.constructor(note);
      return this.signature;
    }
  }, {
    key: 'pianoKey',
    get: function () {
      return _pianoKeys$frequencies.pianoKeys[this.signature];
    }
  }, {
    key: 'frequency',
    get: function () {
      return _pianoKeys$frequencies.frequencies[this.pianoKey];
    }
  }, {
    key: 'alternateName',
    get: function () {
      return _getAlternateName2['default'](this.signature);
    }
  }, {
    key: 'interval',
    value: function interval(steps) {
      return Note.fromPianoKey(this.pianoKey + steps);
    }
  }, {
    key: 'downOctave',
    value: function downOctave() {
      return this.interval(-12);
    }
  }, {
    key: 'minorSecond',
    value: function minorSecond() {
      return this.interval(1);
    }
  }, {
    key: 'majorSecond',
    value: function majorSecond() {
      return this.interval(2);
    }
  }, {
    key: 'minorThird',
    value: function minorThird() {
      return this.interval(3);
    }
  }, {
    key: 'majorThird',
    value: function majorThird() {
      return this.interval(4);
    }
  }, {
    key: 'perfectFourth',
    value: function perfectFourth() {
      return this.interval(5);
    }
  }, {
    key: 'diminishedFifth',
    value: function diminishedFifth() {
      return this.interval(6);
    }
  }, {
    key: 'perfectFifth',
    value: function perfectFifth() {
      return this.interval(7);
    }
  }, {
    key: 'minorSixth',
    value: function minorSixth() {
      return this.interval(8);
    }
  }, {
    key: 'majorSixth',
    value: function majorSixth() {
      return this.interval(9);
    }
  }, {
    key: 'minorSeventh',
    value: function minorSeventh() {
      return this.interval(10);
    }
  }, {
    key: 'majorSeventh',
    value: function majorSeventh() {
      return this.interval(11);
    }
  }, {
    key: 'perfectOctave',
    value: function perfectOctave() {
      return this.interval(12);
    }
  }, {
    key: 'augmentedFourth',
    value: function augmentedFourth() {
      return this.diminishedFifth();
    }
  }, {
    key: 'third',
    value: function third() {
      return this.majorThird();
    }
  }, {
    key: 'fifth',
    value: function fifth() {
      return this.perfectFifth();
    }
  }], [{
    key: 'fromPianoKey',
    value: function fromPianoKey(pianoKey) {
      var note = _getNoteFromPianoKey2['default'](pianoKey);
      return new this(note);
    }
  }]);

  return Note;
})();

exports['default'] = Note;
module.exports = exports['default'];