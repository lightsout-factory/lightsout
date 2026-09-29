interface Params {
	text: string;
}

/** The labels both interview skills mandate. */
export const isQuestionText = ({ text }: Params): boolean => {
	const supportingLabels = ['**Context:**', '**Options:**', '**Recommendation:**'];

	return text.includes('**Question:**') && supportingLabels.some((label) => text.includes(label));
};
