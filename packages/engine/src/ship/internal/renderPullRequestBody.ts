interface Params {
	template: string;
	/** Brace-wrapped names the template may use: the ticket pattern's named groups, plus `branch`. */
	tokens: Record<string, string>;
}

/**
 * An unknown token stays visible: a pull request showing `{number}` reveals the config mistake
 * where a blank line would not. One pass, so a substituted value containing braces is never
 * re-scanned as a token.
 */
export const renderPullRequestBody = ({ template, tokens }: Params): string => {
	return template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (written, name: string) => tokens[name] ?? written);
};
