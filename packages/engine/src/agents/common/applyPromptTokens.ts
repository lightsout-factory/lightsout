interface Params {
	/** Prompt text carrying double-brace tokens. */
	text: string;
	/** Token name to value; a token with no entry is left as written. */
	tokens: Record<string, string | number>;
}

/**
 * A number the engine enforces must read the same in the prompt as in the check,
 * so prompts carry tokens rather than hard-coded values.
 *
 * A token left in a written plan means its template skipped this function, and
 * the plan lint's unresolved-`{token}` scan is right to flag it: the doubled
 * braces are a delimiter, not an escape, and still match that scan.
 */
export const applyPromptTokens = ({ text, tokens }: Params): string => {
	let applied = text;

	for (const [name, value] of Object.entries(tokens)) {
		applied = applied.split(`{{${name}}}`).join(String(value));
	}

	return applied;
};
