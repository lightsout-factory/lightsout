interface Params {
	text: string;
}

/** English prose and code average about four characters to a token across the models a harness runs. */
const charactersPerToken = 4;

/**
 * An estimate, never a count: each model splits text its own way, and the
 * number is shown so packs can be compared, not billed.
 */
export const estimateTokens = ({ text }: Params): number => Math.ceil(text.length / charactersPerToken);
