import type { ZodError } from 'zod';

interface Params {
	error: ZodError;
}

/**
 * Zod's own `message` is a JSON dump of its issue array, which buries the
 * schema's sentences in punctuation. Only the issue lines come back: each
 * caller writes its own headline about what was rejected.
 */
export const describeConfigIssues = ({ error }: Params): string[] =>
	error.issues.map((issue) => {
		const where = issue.path.join('.');

		return `  ${where === '' ? '' : `${where}: `}${issue.message}`;
	});
