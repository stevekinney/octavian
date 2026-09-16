/**
 * Pure scoring logic. A score tracks cumulative results and a streak; both the
 * session score and the all-time score share this shape.
 */

export type Score = {
	/** Number of correct guesses. */
	correct: number;
	/** Total number of guesses. */
	total: number;
	/** Current run of consecutive correct guesses. */
	streak: number;
	/** Longest streak ever reached. */
	best: number;
};

/** A fresh, zeroed score. */
export const EMPTY_SCORE: Score = { correct: 0, total: 0, streak: 0, best: 0 };

/**
 * Apply a guess to a score, returning a new score. A correct guess increments
 * `correct`, extends the `streak`, and raises `best` if the streak is a record.
 * A wrong guess resets the `streak` to zero. Always increments `total`.
 */
export function applyGuess(score: Score, wasCorrect: boolean): Score {
	const streak = wasCorrect ? score.streak + 1 : 0;
	return {
		correct: score.correct + (wasCorrect ? 1 : 0),
		total: score.total + 1,
		streak,
		best: Math.max(score.best, streak)
	};
}

/** The accuracy percentage, rounded to a whole number. Zero when no guesses. */
export function percent(score: Score): number {
	if (score.total === 0) return 0;
	return Math.round((score.correct / score.total) * 100);
}

/** Type guard validating a parsed value is a well-formed {@link Score}. */
export function isScore(value: unknown): value is Score {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.correct === 'number' &&
		typeof candidate.total === 'number' &&
		typeof candidate.streak === 'number' &&
		typeof candidate.best === 'number'
	);
}
