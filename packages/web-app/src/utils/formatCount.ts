interface Params {
	count: number;
	/** The singular noun — 'file', 'invocation'. */
	noun: string;
	/** The plural, when adding an 's' would not produce it — 'writer batches'. */
	plural?: string;
}

export const formatCount = ({ count, noun, plural }: Params): string => `${count} ${count === 1 ? noun : (plural ?? `${noun}s`)}`;
