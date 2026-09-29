interface Params {
	text: string;
	/** 0-based character offset into `text`. */
	index: number;
}

/** 1-based line of a 0-based offset. */
export const getLineNumber = ({ text, index }: Params): number => text.slice(0, index).split('\n').length;
