# Octavian

Octavian is a little utility library for working with musical notes and their frequencies. Super cool, right?

## Installation

First things, first: how do I install this thing?

```js
npm install octavian
```

Maybe you even throw a `--save` in there if you feel like keeping it around.

## Usage

So, we've got Octavian installed, how do we use it?

```js
var Octavian = require('octavian');

var note = new Octavian.Note('A4');
```

Or, if you're some kind of hipster…

```js
var Note = require('octavian').Note;

var note = new Note('A4');
```

### The Basics

A `Note` has a few properties that we can play around with.

```js
var note = new Note('A#4');

note.letter; // 'A'
note.modifier; // '#'
note.octave; // 4
note.signature; // 'A#4'
note.pianoKey; // 50
note.frequency; // 466.164
```

### Normalization

But, what if we toss in some bogus note? Something like `E#`, maybe? There is no `E#`, right?

```js
var note = new Note('E#5');

note.signature; // 'F5'
```

### Intervals

Music is all about intervals. We can move up by a semitone or some other interval.

```js
var note = new Note('C3');

note.majorThird(); // returns a new Note('E3');
note.perfectFifth(); // returns a new Note('G3');
note.perfectOctave(); // returns a new Note('C4');
```

You can do any of the following:

* `downOctave()`
* `minorSecond()`
* `majorSecond()`
* `minorThird()`
* `majorThird()`
* `perfectFourth()`
* `diminishedFifth()`
* `perfectFifth()`
* `minorSixth()`
* `majorSixth()`
* `minorSeventh()`
* `majorSeventh()`
* `perfectOctave()`

There are also some extra methods that are aliased, if you'd prefer:

* `augmentedFourth()`
* `third()`
* `fifth()`

### Chords

You can create chords with Octavian.

```js
const cMajorChord = new Octavian.Chord('C4', 'major');

cMajorChord.notes; // returns [ { letter: 'C', modifier: null, octave: 4 },
                   //           { letter: 'E', modifier: null, octave: 4 },
                   //           { letter: 'G', modifier: null, octave: 4 } ]

cMajorChord.signatures;  // returns [ 'C4', 'E4', 'G4' ]
cMajorChord.frequencies; // returns [ 261.626, 329.628, 391.995 ]
cMajorChord.pianoKeys;   // returns [ 40, 44, 47 ]
```

You can create the following chords:

* `major`
* `majorSixth`
* `majorSeventh`
* `majorSeventhFlatFive`
* `majorSeventhSharpFive`
* `minor`
* `minorSixth`
* `minorSeventh`
* `minorMajor`
* `dominantSeventh`
* `diminished`
* `diminishedSeventh`
* `halfDimished`

You're also more than welcome to use the following aliases for any of the above:

* `maj` is an alias for `major`
* `6` is an alias for `majorSixth`
* `maj6` is an alias for `majorSixth`
* `7` is an alias for `majorSeventh`
* `maj7` is an alias for `majorSeventh`
* `maj7b5` is an alias for `majorSeventhFlatFive`
* `maj7#5` is an alias for `majorSeventhSharpFive`
* `min` is an alias for `minor`
* `m` is an alias for `minor`
* `min6` is an alias for `minorSixth`
* `m6` is an alias for `minorSixth`
* `min7` is an alias for `minorSeventh`
* `m7` is an alias for `minorSeventh`
* `m#7` is an alias for `minorMajor`
* `min#7` is an alias for `minorMajor`
* `m(maj7)` is an alias for `minorMajor`
* `dom7` is an alias for `dominantSeventh`
* `dim` is an alias for `diminished`
* `dim7` is an alias for `diminishedSeventh`
* `m7b5` is an alias for `halfDiminshed`

#### Adding Notes to a Chord

You can add notes to a chord manually, if that suits you:

```js
const chord = new Octavian.Chord('C4');

chord.signatures; // returns ['C4']

chord.addInterval('majorThird');
chord.signatures; // returns ['C4', 'E4']

chord.addInterval(7);
chord.signatures; // returns ['C4', 'E4', 'G4']
```

#### Turning a Note into a Chord

You can turn any note into the basis for a chord:

```js
const note = new Octavian.Note('C4');
note.toChord(); // returns a new chord with only C4 in it.
note.toChord('major'); // returns a new chord with C4, E4, and G4 in it
```

