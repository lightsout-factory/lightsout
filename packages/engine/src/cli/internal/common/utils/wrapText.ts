interface Params {
	text: string;
	/** Total columns the finished lines may occupy, indent included. */
	width: number;
	/** Prefix every line carries. */
	indent: string;
}

/**
 * A word longer than the width is left whole rather than split: the long words
 * here are file paths, and a broken path cannot be copied, clicked or searched.
 */
export const wrapText = ({ text, width, indent }: Params): string[] => {
	const available = Math.max(width - indent.length, 1);
	const lines: string[] = [];
	let current = '';

	for (const word of text.split(/\s+/).filter(Boolean)) {
		if (current === '') {
			current = word;
			continue;
		}

		if (`${current} ${word}`.length <= available) {
			current = `${current} ${word}`;
			continue;
		}

		lines.push(`${indent}${current}`);
		current = word;
	}

	if (current !== '') {
		lines.push(`${indent}${current}`);
	}

	return lines;
};
