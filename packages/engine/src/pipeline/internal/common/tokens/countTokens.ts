interface Params {
	text: string;
}

/**
 * A trailing comma is not counted: the formatter adds and removes those when it
 * re-wraps a line.
 *
 * Language-blind on purpose: a mechanical phase changes Markdown, JSON and
 * snapshots as well as TypeScript.
 */
export const countTokens = ({ text }: Params): Map<string, number> => {
	const tokens = text.match(/[\p{L}\p{N}_$]+|[^\s\p{L}\p{N}_$]/gu) ?? [];
	const counts = new Map<string, number>();

	for (const [index, token] of tokens.entries()) {
		const trailingComma = token === ',' && [')', ']', '}'].includes(tokens[index + 1] ?? '');

		if (!trailingComma) {
			counts.set(token, (counts.get(token) ?? 0) + 1);
		}
	}

	return counts;
};
