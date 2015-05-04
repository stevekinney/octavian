'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _pianoKeys = require('./piano-keys');

var noteIndex = swapKeysAndValues(_pianoKeys.pianoKeys);

exports['default'] = function (pianoKey) {
  return noteIndex[pianoKey];
};

function swapKeysAndValues(object) {
  return Object.keys(object).reduce(function (newObject, key) {
    var value = object[key];
    newObject[value] = key;
    return newObject;
  }, {});
}
module.exports = exports['default'];