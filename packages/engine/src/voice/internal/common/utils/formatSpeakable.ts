interface Params {
	text: string;
}

/** Blank-line runs left behind would become long dead pauses mid-question. */
export const formatSpeakable = ({ text }: Params): string => {
	return text
		.replace(/\*\*/g, '')
		.replace(/`/g, '')
		.replace(/^#{1,6}\s*/gm, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
};
