interface Params {
	/** A doc's markdown, which opens with its `# Title`. */
	text: string;
}

/** The page shows the title itself, so the doc's own opening `# Title` is lifted out of the body rather than shown twice. */
export const splitDocTitle = ({ text }: Params): { title: string | undefined; body: string } => {
	const [first = '', ...rest] = text.trimStart().split('\n');
	const heading = /^#\s+(.+)$/.exec(first);

	return heading === null ? { title: undefined, body: text } : { title: heading[1]?.trim(), body: rest.join('\n').trimStart() };
};
