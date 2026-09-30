import { builtInStandardsLibraryName } from '@lightsout/engine/contracts';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { AddressNotFound } from '#src/common/components/boundaries/AddressNotFound.tsx';
import { defaultPackQueryOptions } from '#src/features/packs/queries/defaultPackQueryOptions.ts';
import { defaultPackRuleQueryOptions } from '#src/features/packs/queries/defaultPackRuleQueryOptions.ts';
import { RuleDetail } from '#src/features/packs/screens/RuleDetail/RuleDetail.tsx';

const RuleNotFound = () => {
	const { library, rule } = Route.useParams();

	return (
		<AddressNotFound title="No rule at that address.">
			The <span className="font-mono">{library}</span> library holds no rule named <span className="font-mono">{rule}</span>. It may have been renamed, and
			these pages show only the {builtInStandardsLibraryName} library.
		</AddressNotFound>
	);
};

const RuleDetailPage = () => {
	const { rule } = Route.useParams();

	return <RuleDetail ruleId={rule} />;
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
