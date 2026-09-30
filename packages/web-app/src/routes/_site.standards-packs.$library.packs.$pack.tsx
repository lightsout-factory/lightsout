import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router';
import { AddressNotFound } from '#src/common/components/boundaries/AddressNotFound.tsx';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { defaultPackQueryOptions } from '#src/features/packs/queries/defaultPackQueryOptions.ts';
import { PackPage } from '#src/features/packs/screens/PackPage/PackPage.tsx';

interface PackSearch {
	check?: CheckKind;
	text?: string;
}

/** A stray value is dropped, so it narrows nothing rather than everything. */
const validateSearch = (search: Record<string, unknown>): PackSearch => ({
	check: Object.values(CheckKind).find((kind) => kind === search.check),
	text: typeof search.text === 'string' && search.text !== '' ? search.text : undefined,
});

const PackNotFound = () => {
	const { library, pack } = Route.useParams();

	return (
		<AddressNotFound title="No pack at that address.">
			The library holds no pack at <span className="font-mono">{`${library}/${pack}`}</span>. Pick one from the Standards Packs page.
		</AddressNotFound>
	);
};

/** Changes navigate with `replace: true`, so back leaves the page rather than unwinding one keystroke at a time. */
const PackRoutePage = () => {
	const { pack } = Route.useParams();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });

	return (
		<PackPage
			pack={pack}
			filters={{ check: search.check, text: search.text }}
			onFiltersChange={(filters) => {
				void navigate({ search: { check: filters.check, text: filters.text }, replace: true });
			}}
		/>
	);
};

export const Route = createFileRoute('/_site/standards-packs/$library/packs/$pack')({
	validateSearch,
	// A pack the bundled library does not hold — or one addressed under another library — is a missing address, not an empty page.
	loader: async ({ context, params }) => {
		const view = await context.queryClient.ensureQueryData(defaultPackQueryOptions());

		if (params.library !== view.name || !view.packs.some((pack) => pack.name === params.pack)) {
			throw notFound();
		}
	},
	head: ({ params }) => ({ meta: [{ title: `${params.library}/${params.pack} — Standards Packs` }] }),
	component: PackRoutePage,
	notFoundComponent: PackNotFound,
});
