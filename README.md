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
