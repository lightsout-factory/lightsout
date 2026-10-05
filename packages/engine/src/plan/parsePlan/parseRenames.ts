import type { RenameRule } from '#src/contracts/plan/renames/RenameRule.ts';
import { getCodeSpans } from '#src/plan/common/getCodeSpans.ts';

interface Params {
	/** Undefined when the section is absent. */
	sectionLines: string[] | undefined;
	/** 1-based line number of the section's first line in the plan file. */
	firstLine: number;
}

/**
 * Renames keep their document order, because that is the order they are
 * applied in. A bullet with any other number of spans than two is recorded so
 * the lint can report it rather than lose a rename the plan meant.
 */
export const parseRenames = ({ sectionLines, firstLine }: Params): { renames: RenameRule[]; malformedLines: number[] } => {
	const renames: RenameRule[] = [];
	const malformedLines: number[] = [];

	for (const [index, line] of (sectionLines ?? []).entries()) {
		if (!/^\s*-\s+/.test(line)) {
			continue;
		}

		const spans = getCodeSpans({ line });

		if (spans.length === 2) {
			renames.push({ from: spans[0], to: spans[1], line: firstLine + index });
		} else {
			malformedLines.push(firstLine + index);
		}
	}

	return { renames, malformedLines };
};
