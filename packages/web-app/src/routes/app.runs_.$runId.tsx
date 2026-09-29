import { createFileRoute } from '@tanstack/react-router';
import { runQueryOptions } from '#src/features/runDetail/queries/runQueryOptions.ts';
import { RunDetail } from '#src/features/runDetail/screens/RunDetail/RunDetail.tsx';

// The trailing underscore on `runs_` stops the file router nesting this page
// inside the runs list; the URL is still /app/runs/$runId.

/** Reached because `getRunServerFn` turns `RunNotFoundError` into `notFound()` on the server. */
const RunNotFound = () => {
	const { runId } = Route.useParams();

	return (
		<div className="flex h-full flex-col items-start justify-center gap-2 p-10">
			<h1 className="font-semibold text-lg">No run matching that id.</h1>
			<p className="text-muted-foreground text-sm">
				Nothing on disk answers to <span className="font-mono">{runId}</span>. Pick one from the runs list.
			</p>
		</div>
	);
};

const RunDetailPage = () => {
	const { runId } = Route.useParams();

	return <RunDetail runId={runId} />;
};

export const Route = createFileRoute('/app/runs_/$runId')({
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(runQueryOptions({ runId: params.runId }));
	},
	component: RunDetailPage,
	notFoundComponent: RunNotFound,
});
