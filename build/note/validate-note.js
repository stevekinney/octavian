'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = validateNote;

var _pianoKeys = require('./piano-keys');

var validNotes = Object.keys(_pianoKeys.pianoKeys);

function validateNote(signature) {
  if (validNotes.indexOf(signature) === -1) {
    throw new Error('Out of range');
  }
}

module.exports = exports['default'];