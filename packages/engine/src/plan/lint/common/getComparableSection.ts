interface Params {
	/** Its heading line included. */
	lines: string[];
}

/**
 * How a section joins the heading below it is the rewriter's business, so a file
 * differing from the rendered text only in how it ends is current. Shared so the
 * two currency checks cannot drift apart.
 */
export const getComparableSection = ({ lines }: Params): string => {
	const trimmed = lines.map((line) => line.replace(/\s+$/, ''));

	while (trimmed.at(-1) === '') {
		trimmed.pop();
	}

	return trimmed.join('\n');
};
