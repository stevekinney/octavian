/** Clef names supported by VexFlow 5. */
export type Clef =
	| 'treble'
	| 'bass'
	| 'alto'
	| 'tenor'
	| 'percussion'
	| 'soprano'
	| 'mezzo-soprano'
	| 'baritone-c'
	| 'baritone-f'
	| 'subbass'
	| 'french'
	| 'tab';

export type KeySignature =
	| 'Am'
	| 'Em'
	| 'Bm'
	| 'F#m'
	| 'C#m'
	| 'G#m'
	| 'D#m'
	| 'A#m'
	| 'Dm'
	| 'Gm'
	| 'Cm'
	| 'Fm'
	| 'Bbm'
	| 'Ebm'
	| 'Abm'
	| 'Cb'
	| 'Gb'
	| 'Db'
	| 'Ab'
	| 'Eb'
	| 'Bb'
	| 'F'
	| 'C'
	| 'G'
	| 'D'
	| 'A'
	| 'E'
	| 'B'
	| 'F#'
	| 'C#';

/** VexFlow duration codes. Set rest to render a rest instead of a note. */
export type NoteDuration = 'w' | 'h' | 'q' | '8' | '16' | '32' | '64';

export interface NotationNote {
	/** VexFlow key strings, for example `c/4` or `c#/4`. Multiple keys form a chord. For tab clef use string/fret pairs, for example `1/3`. */
	keys: string[];
	duration: NoteDuration;
	dots?: 0 | 1 | 2;
	stemDirection?: 'up' | 'down' | 'auto';
	rest?: boolean;
}

export interface NotationMeasure {
	notes: NotationNote[];
}

export type NotationContent =
	{ notes?: NotationNote[]; measures?: never } | { measures?: NotationMeasure[]; notes?: never };

export type NotationOptions = NotationContent & {
	clef?: Clef;
	keySignature?: KeySignature;
	timeSignature?: string;
	ariaLabel?: string;
};
