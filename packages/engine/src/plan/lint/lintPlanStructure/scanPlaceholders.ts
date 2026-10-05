import { isLineInRange } from '#src/plan/lint/lintPlanStructure/common/isLineInRange.ts';

const placeholderPatterns: { label: string; re: RegExp; skipInFence?: boolean }[] = [
	{ label: '???', re: /\?\?\?/ },
	{ label: 'TBD', re: /\bTBD\b/ },
	{ label: 'TODO', re: /\bTODO\b/ },
	{ label: 'unresolved {token}', re: /(?<!\$)\{[A-Za-z][A-Za-z0-9_]*\}/, skipInFence: true },
];

interface Params {
	/** Fence state is tracked per call. */
	lines: string[];
	/** 1-based and inclusive: the Decision Log, whose words are a record rather than an open question. */
	skipRange?: { start: number; end: number };
}

/**
 * `skipInFence` patterns go quiet inside code blocks, where real code writes
 * destructuring and JSX braces. `skipRange` is skipped inside the scan rather than
 * filtered from its result, because only the first hit per label is reported and
 * a marker there would hide a real one further down. Fence state is still
 * tracked across the skipped lines.
 */
export const scanPlaceholders = ({ lines, skipRange }: Params): { label: string; line: number }[] => {
	const matches: { label: string; line: number }[] = [];
	const reported = new Set<string>();
	let inFence = false;

	for (const [index, line] of lines.entries()) {
		if (/^\s*```/.test(line)) {
			inFence = !inFence;

			continue;
		}

		if (isLineInRange({ line: index + 1, range: skipRange })) {
			continue;
		}

		for (const { label, re, skipInFence } of placeholderPatterns) {
			if ((inFence && skipInFence) || reported.has(label)) {
				continue;
			}

			if (re.test(line)) {
				reported.add(label);
				matches.push({ label, line: index + 1 });
			}
		}
	}

	return matches;
};
