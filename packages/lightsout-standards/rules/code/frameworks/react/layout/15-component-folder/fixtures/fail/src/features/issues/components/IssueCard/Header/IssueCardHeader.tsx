interface Params {
	title: string;
}

// Incorrect: a folder inside the component folder. The card's parts sit flat
// beside it; a part with parts of its own becomes a component in components/.
export const IssueCardHeader = ({ title }: Params) => <h2>{title}</h2>;
