interface Params {
	title: string;
}

// Incorrect: ui/ is not a folder a feature holds, so a reader looking for the
// feature's components has to guess the name.
export const IssueRow = ({ title }: Params) => <li>{title}</li>;
