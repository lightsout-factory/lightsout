interface Params {
	/** The lines `renderResult` answered. */
	lines: string[];
}

/** The labelled summary lines of a result card, with the step table's box-drawn rows and the blank spacers dropped. */
export const resultLabelLines = ({ lines }: Params): string[] => lines.filter((line) => line !== '' && !/^[┌├└│]/.test(line));
