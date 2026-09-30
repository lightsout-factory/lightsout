interface Params {
	text: string;
	/** A single-line pattern whose first capture group is the name being declared. Must not be global — a global pattern would skip every other line. */
	pattern: RegExp;
}

export const scanTestLines = ({ text, pattern }: Params): Array<{ name: string; line: number }> => {
	const declared: Array<{ name: string; line: number }> = [];

	text.split('\n').forEach((line, index) => {
		const name = line.match(pattern)?.[1] ?? '';

		if (name !== '') {
			declared.push({ name, line: index + 1 });
		}
	});

	return declared;
};
