import { useQuery } from '@tanstack/react-query';
import { Markdown } from '#src/appUI/Markdown.tsx';
import { Skeleton } from '#src/appUI/Skeleton.tsx';
import { planQueryOptions } from '#src/features/runDetail/queries/planQueryOptions.ts';

interface Props {
	/** Repo-relative path of a markdown file inside the workspace. */
	path: string;
}

/**
 * Shares the run detail's plan query, so a plan opened from either page is one
 * cached document. A missing file is a normal state, not an error.
 */
export const PlanDocumentBody = ({ path }: Props) => {
	const { data: plan } = useQuery(planQueryOptions({ path }));

	if (plan === undefined) {
		return <Skeleton className="h-64 w-full" />;
	}

	return plan.text === undefined ? <p className="text-muted-foreground text-sm">Nothing is on disk at that path any more.</p> : <Markdown text={plan.text} />;
};
