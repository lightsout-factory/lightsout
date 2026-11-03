interface Params {
	title: string;
}

// Correct: a component the screen composes, in the feature's components/.
export const IssueRow = ({ title }: Params) => <li>{title}</li>;
