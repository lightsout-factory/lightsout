import { basename } from 'node:path';
import { planSentinelTokens } from '#src/plan/common/constants/planSentinelTokens.ts';
import { getCodeSpans } from '#src/plan/common/getCodeSpans.ts';
import { isPathToken } from '#src/plan/common/paths/isPathToken.ts';

interface Params {
	lines: string[];
}

const isIdentifierSpan = ({ span }: { span: string }) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(span);

/**
 * Each token maps to the spelling the lines used, so a finding quotes the
 * author's own words.
 *
 * A path span reduces to its basename: plans spell the same file both
 * repo-relative and through a package alias (`#src/...`), and a verbatim
 * comparison would report a hand-off as broken over spelling alone.
 *
 * Only bare identifiers count otherwise, narrow on purpose: an export name is
 * what crosses a phase boundary, and every wider shape is prose that would
 * generate false alarms.
 */
export const getComparableTokens = ({ lines }: Params): Map<string, string> => {
	const tokens = new Map<string, string>();

	for (const line of lines) {
		for (const span of getCodeSpans({ line })) {
			if (planSentinelTokens.has(span)) {
				continue;
			}

			if (isPathToken({ token: span })) {
				tokens.set(basename(span), span);
			} else if (isIdentifierSpan({ span })) {
				tokens.set(span, span);
			}
		}
	}

	return tokens;
};
