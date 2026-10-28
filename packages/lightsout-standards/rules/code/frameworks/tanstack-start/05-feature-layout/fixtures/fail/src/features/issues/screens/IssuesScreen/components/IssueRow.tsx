interface Params {
	title: string;
}

// Incorrect: features/, screens/ and components/ each name a kind of code, and
// the file is four folders from the feature it belongs to.
export const IssueRow = ({ title }: Params) => <li>{title}</li>;
