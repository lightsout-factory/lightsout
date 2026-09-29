import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router';
import { AddressNotFound } from '#src/common/components/boundaries/AddressNotFound.tsx';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { toRuleSetChannel } from '#src/features/packs/internal/common/utils/toRuleSetChannel.ts';
import { defaultPackQueryOptions } from '#src/features/packs/queries/defaultPackQueryOptions.ts';
import { RuleSetPage } from '#src/features/packs/screens/RuleSetPage/RuleSetPage.tsx';

interface RuleSetSearch {
	check?: CheckKind;
	text?: string;
}

/** A stray value is dropped, so it narrows nothing rather than everything. */
const validateSearch = (search: Record<string, unknown>): RuleSetSearch => ({
	check: Object.values(CheckKind).find((kind) => kind === search.check),
	text: typeof search.text === 'string' && search.text !== '' ? search.text : undefined,
});

const RuleSetNotFound = () => {
	const { ruleSet } = Route.useParams();

	return (
		<AddressNotFound title="No rules by that name.">
			The default pack holds no <span className="font-mono">{ruleSet}</span> rules. Pick a set from the Standards Packs page.
		</AddressNotFound>
	);
};

/** Changes navigate with `replace: true`, so back leaves the page rather than unwinding one keystroke at a time. */
const RuleSetRoutePage = () => {
	const { ruleSet } = Route.useParams();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });

	return (
		<RuleSetPage
			ruleSet={ruleSet}
			filters={{ check: search.check, text: search.text }}
			onFiltersChange={(filters) => {
				void navigate({ search: { check: filters.check, text: filters.text }, replace: true });
			}}
		/>
	);
};

export const Route = createFileRoute('/_site/standards-packs/$ruleSet/')({
	validateSearch,
	// A set the pack holds no rules in is a missing address, not an empty page.
	loader: async ({ context, params }) => {
		const channel = toRuleSetChannel({ ruleSet: params.ruleSet });
		const pack = await context.queryClient.ensureQueryData(defaultPackQueryOptions());

		if (!pack.channelTotals.some((total) => total.channel === channel)) {
			throw notFound();
		}
	},
	head: ({ params }) => ({ meta: [{ title: `${params.ruleSet} rules — Standards Packs` }] }),
	component: RuleSetRoutePage,
	notFoundComponent: RuleSetNotFound,
});
