import { formatShortRunId } from '@lightsout/shared';
import { Link } from '@tanstack/react-router';

interface Props {
	runId: string;
}

export const ChildRunLink = ({ runId }: Props) => {
	return (
		<Link to="/app/runs/$runId" params={{ runId }} className="font-mono text-primary text-xs underline underline-offset-2">
			{formatShortRunId({ runId })}
		</Link>
	);
};
