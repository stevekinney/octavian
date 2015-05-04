'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
var validNoteLetters = 'ABCDEFG';
var validSharpNotes = 'ACDFG';
var validFlatNotes = 'ABDEG';
var validModifiers = '#b';

exports['default'] = function (note) {
  var letter = note.charAt(0).toUpperCase();
  var modifier = note.charAt(1) || null;

  if (modifier === 'b' && validFlatNotes.indexOf(letter) === -1) {
    letter = validNoteLetters.charAt(validNoteLetters.indexOf(letter) - 1);
    modifier = null;
  }

  if (modifier === '#' && validSharpNotes.indexOf(letter) === -1) {
    letter = validNoteLetters.charAt(validNoteLetters.indexOf(letter) + 1);
    modifier = null;
  }

  validateLetter(letter);
  validateModifier(modifier);

  return { letter: letter, modifier: modifier };
};

function validateLetter(letter) {
  if (validNoteLetters.indexOf(letter) === -1) {
    throw new Error('Invalid note letter');
  }
}

function validateModifier(modifier) {
  if (modifier && validModifiers.indexOf(modifier) === -1) {
    throw new Error('Invalid modifier');
  }
}
module.exports = exports['default'];