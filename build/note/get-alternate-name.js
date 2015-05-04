'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _slicedToArray = function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } };

var alternateNames = {
  Ab: 'G#',
  'A#': 'Bb',
  Bb: 'A#',
  'C#': 'Db',
  Db: 'C#',
  'D#': 'Eb',
  Eb: 'D#',
  'F#': 'Gb',
  Gb: 'F#',
  'G#': 'Ab'
};

exports['default'] = function (signature) {
  var _signature$match$slice = signature.match(/([A-G][b#]{0,1})(\d)/).slice(1, 3);

  var _signature$match$slice2 = _slicedToArray(_signature$match$slice, 2);

  var note = _signature$match$slice2[0];
  var octave = _signature$match$slice2[1];

  if (!alternateNames[note]) {
    return null;
  }
  return alternateNames[note] + octave;
};

module.exports = exports['default'];