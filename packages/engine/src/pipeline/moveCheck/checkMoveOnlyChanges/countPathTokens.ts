import { countTokens } from '#src/pipeline/common/countTokens.ts';

interface Params {
	text: string;
	/** Declared move paths (no trailing `/`) and their last segments: a run equal to one is a path run even without a `/`. */
	standalonePaths: Set<string>;
}

/**
 * Splits a text into the tokens inside path runs and the tokens outside them, so
 * a move check can let a path's `/`, `.` and `-` change while the same
 * characters elsewhere, such as a `//` comment-out or a `-1`, must stay as they
 * were. A run is a maximal span of letters, digits and `_ $ @ # ~ . / -`; it is
 * a path run when it holds a `/` beside a letter or digit, or when it equals a
 * declared move path or that path's last segment.
 */
export const countPathTokens = ({ text, standalonePaths }: Params): { inside: Map<string, number>; outside: Map<string, number> } => {
	const pathRuns: string[] = [];
	const rest = text.replace(/[\p{L}\p{N}_$@#~./-]+/gu, (run) => {
		const isPathRun = (run.includes('/') && /[\p{L}\p{N}]/u.test(run)) || standalonePaths.has(run);

		if (isPathRun) {
			pathRuns.push(run);
		}

		return isPathRun ? ' ' : run;
	});

	return { inside: countTokens({ text: pathRuns.join('\n') }), outside: countTokens({ text: rest }) };
};
