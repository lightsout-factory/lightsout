interface Params {
	title: string;
}

// Correct: a part of the card, beside the card.
export const IssueCardHeader = ({ title }: Params) => <h2>{title}</h2>;
