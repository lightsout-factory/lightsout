import { Link } from '@tanstack/react-router';

interface Props {
	runId: string;
}

export const ChildRunLink = ({ runId }: Props) => {
	const shortId = runId.slice(0, 8);

	return (
		<Link to="/app/runs/$runId" params={{ runId }} className="font-mono text-primary text-xs underline underline-offset-2">
			{shortId}
		</Link>
	);
};
