import { describe, expect, jest, test } from '@jest/globals';
import { toStandardsPackRuleView, toStandardsPackView } from '@lightsout/engine';
import { QueryClient } from '@tanstack/react-query';
import { createRouter, isNotFound } from '@tanstack/react-router';
import { fireEvent, screen, within } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { getDefaultPackBundle } from '#src/lightsout/common/utils/getDefaultPackBundle.ts';
import { routeTree } from '#src/routeTree.gen.ts';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
// Only the pieces that need a live router around them are stood in for, so a
// single route's component can be rendered on its own. Everything else — above
// all `createRouter` and the `createFileRoute` calls the tree is assembled from
// — stays real, since the tree is what is under test here.
const mockNavigate = jest.fn<(options: { search: Record<string, unknown>; replace: boolean }) => void>();

jest.mock('@tanstack/react-router', () => {
	const actual = jest.requireActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');

	return {
		...actual,
		Link: ({ to, params, children, className }: { to: string; params?: Record<string, string>; children: ReactNode; className?: string }) => (
			<a href={Object.entries(params ?? {}).reduce((path, [name, value]) => path.replace(`$${name}`, value), to)} className={className}>
				{children}
			</a>
		),
		// The pack page writes its filters into the URL. Outside a live router
		// there is nothing to navigate, and what the route decides — which keys it
		// writes, and that it replaces rather than pushes — is what this file reads.
		useNavigate: () => mockNavigate,
	};
});
// -------------------------

/** Whatever path parameters a standards-zone route carries — all optional, so one interface serves all three. */
interface PageParams {
	rule?: string;
	library?: string;
	pack?: string;
}

/**
 * One of the tree's standards-zone file routes, narrowed to what this file
 * reads.
 *
 * The router types these against its own deeply generic route shapes; restating
 * those here would be noise rather than safety, so each entry names only the
 * argument the app's own code passes it and the value it hands back.
 */
interface FilePage {
	options: {
		component: ComponentType;
		notFoundComponent: ComponentType;
		loader: (input: { context: { queryClient: QueryClient }; params?: PageParams }) => Promise<unknown>;
		head: (input: { params: PageParams }) => { meta: { title: string }[] };
		validateSearch: (search: Record<string, unknown>) => Record<string, unknown>;
	};
	useParams: () => PageParams;
	useSearch: () => Record<string, unknown>;
}

/**
 * The tree over the real shipped pack: these pages document the default pack
 * bundled into the app, so the tests read it rather than a stand-in.
 */
const setupRouteTree = () => {
	const pack = toStandardsPackView({ bundle: getDefaultPackBundle() });
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const router = createRouter({ routeTree, context: { queryClient } });
	const pages = (router as unknown as { routesById: Record<string, FilePage> }).routesById;

	return { pack, pages, queryClient };
};

/** Any route's loader, with the client it fills. */
const setupLoader = ({ id }: { id: string }) => {
	const { pack, pages, queryClient } = setupRouteTree();

	return { loader: pages[id].options.loader, pack, queryClient };
};

const setupPacksPage = () => {
	const { pack, pages } = setupRouteTree();
	const Page = pages['/_site/standards-packs/'].options.component;

	renderWithQueryClient({ ui: <Page />, seed: [{ queryKey: [QueryKey.DefaultPack], data: pack }] });
};

/**
 * The pack route, rendered for one pack and one set of URL filters.
 *
 * `Route.useParams()` and `Route.useSearch()` read the match a live router is
 * showing, so both come from spies rather than from a router driven to the path
 * — which is the routing library's behaviour, not this route's.
 */
const setupPackPage = ({ search = {} }: { search?: Record<string, unknown> } = {}) => {
	const { pack, pages } = setupRouteTree();
	const route = pages['/_site/standards-packs/$library/packs/$pack'];
	jest.spyOn(route, 'useParams').mockReturnValue({ library: 'lightsout', pack: 'standards' });
	jest.spyOn(route, 'useSearch').mockReturnValue(search);
	const Page = route.options.component;

	renderWithQueryClient({ ui: <Page />, seed: [{ queryKey: [QueryKey.DefaultPack], data: pack }] });
};

/** The same route's answer for a pack the library does not hold. */
const setupMissingPackPage = ({ pack = 'vue' }: { pack?: string } = {}) => {
	const { pages } = setupRouteTree();
	const route = pages['/_site/standards-packs/$library/packs/$pack'];
	jest.spyOn(route, 'useParams').mockReturnValue({ library: 'lightsout', pack });
	const Page = route.options.notFoundComponent;

	renderWithQueryClient({ ui: <Page /> });
};

/** The rule page, for one address. */
const setupRuleDetailPage = ({ rule = 'folder-size' }: { rule?: string } = {}) => {
	const { pack, pages } = setupRouteTree();
	const route = pages['/_site/standards-packs/$library/rules/$rule'];
	jest.spyOn(route, 'useParams').mockReturnValue({ library: 'lightsout', rule });
	const Page = route.options.component;

	renderWithQueryClient({
		ui: <Page />,
		seed: [
			{ queryKey: [QueryKey.DefaultPackRule, rule], data: toStandardsPackRuleView({ bundle: getDefaultPackBundle(), rule }) },
			{ queryKey: [QueryKey.DefaultPack], data: pack },
		],
	});
};

/** The same route's answer for a rule the library does not carry. */
const setupMissingRulePage = ({ library = 'lightsout', rule = 'one-exported-function-per-file' }: { library?: string; rule?: string } = {}) => {
	const { pages } = setupRouteTree();
	const route = pages['/_site/standards-packs/$library/rules/$rule'];
	jest.spyOn(route, 'useParams').mockReturnValue({ library, rule });
	const Page = route.options.notFoundComponent;

	renderWithQueryClient({ ui: <Page /> });
};

/** Clicks one of the kind-of-check switch's options by its label. */
const pressCheckKind = ({ label }: { label: string }) =>
	fireEvent.click(within(screen.getByRole('group', { name: 'Kind of check' })).getByRole('button', { name: label }));

// The sell zone's three standards routes: what `/standards-packs/`,
// `/standards-packs/$library/packs/$pack` and `/standards-packs/$library/rules/$rule`
// serve, and what the pack route does with the query string it owns.
describe('routeTree standards routes', () => {
	test('the packs route shows a card for each pack the shipped library holds', () => {
		setupPacksPage();

		expect(screen.getByRole('heading', { level: 3, name: 'standards' })).toBeInTheDocument();
	});

	test('the packs route warms its own list before the page renders', async () => {
		const { loader, pack, queryClient } = setupLoader({ id: '/_site/standards-packs/' });

		await loader({ context: { queryClient } });

		expect(queryClient.getQueryData([QueryKey.DefaultPack])).toStrictEqual(pack);
	});

	test('the pack route renders the pack the path names, by its address', () => {
		setupPackPage();

		const heading = screen.getByRole('heading', { level: 1, name: 'lightsout/standards' });

		expect(heading).toBeInTheDocument();
	});

	test('the pack route names the tab from the path alone, before any query has resolved', () => {
		const { pages } = setupRouteTree();

		const head = pages['/_site/standards-packs/$library/packs/$pack'].options.head({ params: { library: 'lightsout', pack: 'react' } });

		expect(head.meta).toStrictEqual([{ title: 'lightsout/react — Standards Packs' }]);
	});

	test('the pack route warms the shipped library before the page renders', async () => {
		const { loader, pack, queryClient } = setupLoader({ id: '/_site/standards-packs/$library/packs/$pack' });

		await loader({ context: { queryClient }, params: { library: 'lightsout', pack: 'standards' } });

		expect(queryClient.getQueryData([QueryKey.DefaultPack])).toStrictEqual(pack);
	});

	test('the pack route treats a pack the library does not hold as a missing address, not an empty page', async () => {
		const { loader, queryClient } = setupLoader({ id: '/_site/standards-packs/$library/packs/$pack' });

		const failure = await loader({ context: { queryClient }, params: { library: 'lightsout', pack: 'vue' } }).catch((error: unknown) => error);

		expect(isNotFound(failure)).toBe(true);
	});

	test("the pack route reads the URL's own words and hands the page the filter they mean", () => {
		setupPackPage({ search: { check: 'agent' } });

		const option = within(screen.getByRole('group', { name: 'Kind of check' })).getByRole('button', { name: 'Agent' });

		expect(option).toHaveAttribute('aria-pressed', 'true');
	});

	test('the pack route writes a filter change back as those same words, replacing the URL rather than pushing it', () => {
		setupPackPage();

		pressCheckKind({ label: 'Deterministic' });

		expect(mockNavigate).toHaveBeenCalledWith({ search: { check: 'deterministic', text: undefined }, replace: true });
	});

	test('the pack route drops the key from the URL when the reader goes back to all rules', () => {
		setupPackPage({ search: { check: 'agent' } });

		pressCheckKind({ label: 'All' });

		expect(mockNavigate).toHaveBeenCalledWith({ search: { check: undefined, text: undefined }, replace: true });
	});

	test('the pack route carries the search through a change to the switch', () => {
		setupPackPage({ search: { text: 'cas' } });

		pressCheckKind({ label: 'Agent' });

		expect(mockNavigate).toHaveBeenCalledWith({ search: { check: 'agent', text: 'cas' }, replace: true });
	});

	test('the pack route keeps a query value its vocabulary knows', () => {
		const { pages } = setupRouteTree();

		const search = pages['/_site/standards-packs/$library/packs/$pack'].options.validateSearch({ check: 'deterministic', text: 'cast' });

		expect(search).toStrictEqual({ check: 'deterministic', text: 'cast' });
	});

	test('the pack route ignores a query value outside that vocabulary, rather than filtering to nothing', () => {
		const { pages } = setupRouteTree();

		const search = pages['/_site/standards-packs/$library/packs/$pack'].options.validateSearch({ check: 'vibes', text: '' });

		expect(search).toStrictEqual({ check: undefined, text: undefined });
	});

	test('the pack route says which address the library holds no pack at', () => {
		setupMissingPackPage({ pack: 'vue' });

		const notice = screen.getByText('lightsout/vue');

		expect(notice).toBeInTheDocument();
	});

	test('the rule route renders the rule whose address the path carries', () => {
		setupRuleDetailPage();

		const heading = screen.getByRole('heading', { level: 1, name: 'folder-size' });

		expect(heading).toBeInTheDocument();
	});

	test('the rule route names the tab from the path alone too', () => {
		const { pages } = setupRouteTree();

		const head = pages['/_site/standards-packs/$library/rules/$rule'].options.head({ params: { library: 'lightsout', rule: 'object-args' } });

		expect(head.meta).toStrictEqual([{ title: 'lightsout/object-args — Standards Packs' }]);
	});

	test('the rule route warms the rule it shows', async () => {
		const { loader, queryClient } = setupLoader({ id: '/_site/standards-packs/$library/rules/$rule' });

		await loader({ context: { queryClient }, params: { library: 'lightsout', rule: 'folder-size' } });

		expect(queryClient.getQueryData<{ id: string }>([QueryKey.DefaultPackRule, 'folder-size'])?.id).toBe('folder-size');
	});

	test('the rule route treats a real rule under the wrong library as a missing address', async () => {
		const { loader, queryClient } = setupLoader({ id: '/_site/standards-packs/$library/rules/$rule' });

		const failure = await loader({ context: { queryClient }, params: { library: 'acme', rule: 'folder-size' } }).catch((error: unknown) => error);

		expect(isNotFound(failure)).toBe(true);
	});

	test('the rule route treats a rule the library does not carry as a missing address', async () => {
		const { loader, queryClient } = setupLoader({ id: '/_site/standards-packs/$library/rules/$rule' });

		const failure = await loader({ context: { queryClient }, params: { library: 'lightsout', rule: 'no-such-rule' } }).catch((error: unknown) => error);

		expect(isNotFound(failure)).toBe(true);
	});

	test('the rule route names both halves of an address that leads nowhere', () => {
		setupMissingRulePage({ library: 'acme', rule: 'one-exported-function-per-file' });

		expect([screen.getByText('acme'), screen.getByText('one-exported-function-per-file')]).toHaveLength(2);
	});

	test('the pack page loader answers not found for a pack or library the bundle does not hold', async () => {
		const { loader, queryClient } = setupLoader({ id: '/_site/standards-packs/$library/packs/$pack' });

		const outcomes = await Promise.all(
			[
				{ library: 'lightsout', pack: 'standards' },
				{ library: 'lightsout', pack: 'vue' },
				{ library: 'acme', pack: 'standards' },
			].map((params) =>
				loader({ context: { queryClient }, params }).then(
					() => 'found',
					(error: unknown) => (isNotFound(error) ? 'not found' : error),
				),
			),
		);

		expect(outcomes).toStrictEqual(['found', 'not found', 'not found']);
	});

	test('the rule page loader answers not found for a rule outside the bundled library', async () => {
		const { loader, queryClient } = setupLoader({ id: '/_site/standards-packs/$library/rules/$rule' });

		const outcomes = await Promise.all(
			[
				{ library: 'lightsout', rule: 'function-size' },
				{ library: 'lightsout', rule: 'no-such-rule' },
				{ library: 'acme', rule: 'function-size' },
			].map((params) =>
				loader({ context: { queryClient }, params }).then(
					() => 'found',
					(error: unknown) => (isNotFound(error) ? 'not found' : error),
				),
			),
		);
		const cachedRule = queryClient.getQueryData<{ id: string }>([QueryKey.DefaultPackRule, 'function-size']);

		expect({ outcomes, cachedRuleId: cachedRule?.id }).toStrictEqual({
			outcomes: ['found', 'not found', 'not found'],
			cachedRuleId: 'function-size',
		});
	});

	test('the pack page keeps only a known check kind and non-empty search text', () => {
		const { pages } = setupRouteTree();
		const { validateSearch } = pages['/_site/standards-packs/$library/packs/$pack'].options;

		const searches = [
			{ check: 'deterministic', text: 'cast' },
			{ check: 'vibes', text: '' },
		].map((search) => validateSearch(search));

		expect(searches).toStrictEqual([
			{ check: 'deterministic', text: 'cast' },
			{ check: undefined, text: undefined },
		]);
	});
});
