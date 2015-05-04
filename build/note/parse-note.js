'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _interopRequireDefault = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _normalizeNote2 = require('./normalize-note');

var _normalizeNote3 = _interopRequireDefault(_normalizeNote2);

exports['default'] = function (note) {
  var noteSegments = note.match(/([A-Ga-g])([#b]{0,1})([0-9])/);

  if (!noteSegments) {
    throw new Error('Invalid note format: ' + note + '.');
  }

  var noteWithModifier = noteSegments.slice(1, 3).join('');

  var _normalizeNote = _normalizeNote3['default'](noteWithModifier);

  var letter = _normalizeNote.letter;
  var modifier = _normalizeNote.modifier;

  var octave = noteSegments[3];

  return {
    letter: letter,
    modifier: modifier || null,
    octave: parseInt(octave, 10)
  };
};

module.exports = exports['default'];