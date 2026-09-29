import { createFileRoute, notFound } from '@tanstack/react-router';
import { isPublicDeployment } from '#src/common/utils/isPublicDeployment.ts';
import { AppShell } from '#src/features/app/components/AppShell.tsx';
import { repoRootQueryOptions } from '#src/features/app/queries/repoRootQueryOptions.ts';

/**
 * The public-site check sits in `beforeLoad` so every page under `/app` answers
 * not-found without a line of its own. The server functions refuse on their own
 * too, so this is what the reader sees, not what keeps the disk private.
 *
 * The repo root is fetched here rather than in a loader because loaders run side
 * by side, and a server started outside any repo should show one message
 * naming the fix rather than a failure per page.
 */
export const Route = createFileRoute('/app')({
	beforeLoad: async ({ context }) => {
		if (isPublicDeployment()) {
			throw notFound();
		}

		await context.queryClient.ensureQueryData(repoRootQueryOptions());
	},
	component: AppShell,
});
