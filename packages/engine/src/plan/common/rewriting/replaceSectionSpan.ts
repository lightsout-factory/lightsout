interface Params {
	lines: string[];
	/** 1-based line number of the section's heading. */
	start: number;
	/** 1-based, inclusive: the last line the section owns. */
	end: number;
	/** Heading line included. */
	sectionLines: string[];
}

/**
 * The span already holds the blank lines under the old section, so exactly one
 * is written back whenever a heading follows, which makes a repeated sync leave
 * the file byte-for-byte alone.
 */
export const replaceSectionSpan = ({ lines, start, end, sectionLines }: Params): string[] => {
	const tail = lines.slice(end);
	const separator = tail.length > 0 || lines.at(-1) === '' ? [''] : [];

	return [...lines.slice(0, start - 1), ...sectionLines, ...separator, ...tail];
};
