interface Params {
	title: string;
}

// Correct: used by the screen alone, so it sits beside it, with no folder between.
export const IssueRow = ({ title }: Params) => <li>{title}</li>;
