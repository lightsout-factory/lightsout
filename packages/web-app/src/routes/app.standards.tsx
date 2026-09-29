import { createFileRoute } from '@tanstack/react-router';
import { standardsQueryOptions } from '#src/features/standards/queries/standardsQueryOptions.ts';
import { StandardsPage } from '#src/features/standards/screens/StandardsPage/StandardsPage.tsx';

interface StandardsSearch {
	rule?: string;
}

const validateSearch = (search: Record<string, unknown>): StandardsSearch => ({
	rule: typeof search.rule === 'string' && search.rule !== '' ? search.rule : undefined,
});

export const Route = createFileRoute('/app/standards')({
	validateSearch,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(standardsQueryOptions());
	},
	head: () => ({ meta: [{ title: 'Standards' }] }),
	component: StandardsPage,
});
