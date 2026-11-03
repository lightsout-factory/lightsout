import { createFileRoute } from '@tanstack/react-router';
import { runQueryOptions } from '#src/features/runs/queries/runQueryOptions.ts';
import { RunDetailScreen } from '#src/features/runs/screens/RunDetailScreen.tsx';
import { RunNotFoundScreen } from '#src/features/runs/screens/RunNotFoundScreen.tsx';

// The trailing underscore on `runs_` stops the file router nesting this page
// inside the runs list; the URL is still /app/runs/$runId.

/** Reached because `getRunServerFn` turns `RunNotFoundError` into `notFound()` on the server. */
const RunNotFound = () => {
	const { runId } = Route.useParams();

	return <RunNotFoundScreen runId={runId} />;
};

const RunDetailPage = () => {
	const { runId } = Route.useParams();

	return <RunDetailScreen runId={runId} />;
};

export const Route = createFileRoute('/app/runs_/$runId')({
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(runQueryOptions({ runId: params.runId }));
	},
	component: RunDetailPage,
	notFoundComponent: RunNotFound,
});
