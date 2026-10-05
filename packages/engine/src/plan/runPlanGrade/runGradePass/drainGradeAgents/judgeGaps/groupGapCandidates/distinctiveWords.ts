interface Params {
	text: string;
}

/**
 * The length floor removes the grading vocabulary every finding carries
 * (`plan`, `phase`, `file`) without a hand-kept stop list. No stemming on
 * purpose: shared words only hint which findings a judge sees together, and a
 * hint that batches too eagerly costs a larger prompt and nothing else.
 */
export const distinctiveWords = ({ text }: Params): Set<string> => {
	const minimumLength = 6;

	return new Set(
		text
			.toLowerCase()
			.split(/[^\p{L}\p{N}]+/u)
			.filter((word) => word.length >= minimumLength),
	);
};
