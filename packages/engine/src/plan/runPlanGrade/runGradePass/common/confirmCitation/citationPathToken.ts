import { isPathToken } from '#src/plan/common/paths/isPathToken.ts';

interface Params {
	/** A judge's `answerAt` — a path, optionally with a `:symbol` suffix, or a quoted plan line. */
	citation: string;
}

/**
 * `file.ts:symbol` names the file and never the symbol. The judge join and the
 * re-verification check must split a citation the same way, or one citation
 * would be believed on one route through the grade and refused on the other.
 */
export const citationPathToken = ({ citation }: Params): string | undefined => {
	const token = citation.split(':')[0] ?? '';

	return isPathToken({ token }) ? token : undefined;
};
