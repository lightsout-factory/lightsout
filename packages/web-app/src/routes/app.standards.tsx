import { createFileRoute } from '@tanstack/react-router';
import { StandardsScreen } from '#src/standards/StandardsScreen/StandardsScreen.tsx';
import { standardsQueryOptions } from '#src/standards/standardsQueryOptions.ts';

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
	component: StandardsScreen,
});
