import { createFileRoute, notFound } from '@tanstack/react-router';
import { defaultPackRuleQueryOptions } from '#src/features/packs/queries/defaultPackRuleQueryOptions.ts';
import { RuleDetailScreen } from '#src/features/packs/screens/RuleDetailScreen.tsx';
import { RuleNotFoundScreen } from '#src/features/packs/screens/RuleNotFoundScreen.tsx';
import { defaultPackQueryOptions } from '#src/queries/defaultPackQueryOptions.ts';

const RuleNotFound = () => {
	const { library, rule } = Route.useParams();

	return <RuleNotFoundScreen library={library} rule={rule} />;
};

const RuleDetailPage = () => {
	const { rule } = Route.useParams();

	return <RuleDetailScreen ruleId={rule} />;
};

export const Route = createFileRoute('/_site/standards-packs/$library/rules/$rule')({
	// A real rule under the wrong library is a wrong address, not a page.
	loader: async ({ context, params }) => {
		const view = await context.queryClient.ensureQueryData(defaultPackQueryOptions());

		if (params.library !== view.name || !view.rules.some((rule) => rule.id === params.rule)) {
			throw notFound();
		}

		await context.queryClient.ensureQueryData(defaultPackRuleQueryOptions({ rule: params.rule }));
	},
	head: ({ params }) => ({ meta: [{ title: `${params.library}/${params.rule} — Standards Packs` }] }),
	component: RuleDetailPage,
	notFoundComponent: RuleNotFound,
});
