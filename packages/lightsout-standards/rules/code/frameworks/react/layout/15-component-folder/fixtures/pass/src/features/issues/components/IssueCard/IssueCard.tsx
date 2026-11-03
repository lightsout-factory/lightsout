import { IssueFooter } from '../IssueFooter.tsx';
import { IssueCardHeader } from './IssueCardHeader.tsx';

interface Params {
	title: string;
}

// Correct: the card has a part only it uses, so it has a folder of its own name
// with the part flat beside it.
export const IssueCard = ({ title }: Params) => (
	<article>
		<IssueCardHeader title={title} />
		<IssueFooter />
	</article>
);
