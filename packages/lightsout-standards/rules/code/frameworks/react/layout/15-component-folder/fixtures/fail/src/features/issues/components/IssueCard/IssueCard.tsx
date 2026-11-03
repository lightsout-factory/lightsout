import { IssueCardHeader } from './Header/IssueCardHeader.tsx';
import { IssueFooter } from '../IssueFooter/IssueFooter.tsx';

interface Params {
	title: string;
}

export const IssueCard = ({ title }: Params) => (
	<article>
		<IssueCardHeader title={title} />
		<IssueFooter />
	</article>
);
