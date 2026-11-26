import { describe, expect, jest, test } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { repoRootQueryOptions } from '#src/queries/repoRootQueryOptions.ts';
import { routeTree } from '#src/routeTree.gen.ts';
import appCssHref from '#src/styles/app.css?url';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
// Which repo is open is answered by walking the real filesystem, so the app
// frame would otherwise report whatever directory Jest happened to start in.
// Only the walk is stood in for: whether the site is public stays the real
// `isPublicDeployment`.
const mockRequireLocalRepoRoot = jest.fn<() => string>();

jest.mock('#src/server/requireLocalRepoRoot.ts', () => ({
	requireLocalRepoRoot: () => mockRequireLocalRepoRoot(),
}));
// -------------------------
// Only the pieces that need a live router around them are stood in for, so a
// single route's component can be rendered on its own. Everything else — above
// all `createRouter` and the `createFileRoute` calls the tree is assembled from
// — stays real, since the tree is what is under test here.
jest.mock('@tanstack/react-router', () => {
	const actual = jest.requireActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');

	return {
		...actual,
		HeadContent: () => null,
		Scripts: () => null,
		Outlet: () => <p>the open route</p>,
		Link: ({ to, params, children, className }: { to: string; params?: Record<string, string>; children: ReactNode; className?: string }) => (
			<a href={Object.entries(params ?? {}).reduce((path, [name, value]) => path.replace(`$${name}`, value), to)} className={className}>
				{children}
			</a>
		),
	};
});
// -------------------------

/**
 * The root route's options, narrowed to what this file reads.
 *
 * The router types these against its own deeply generic route shapes; restating
 * those here would be noise rather than safety, so each entry names only the
 * argument the app's own code passes it and the value it hands back.
 */
interface RootPage {
	head: () => { meta: Record<string, string>[]; links: { rel: string; href: string }[] };
	/** Absent: the root asks nothing of any repo, so a public page never waits on one. */
	loader?: (params: { context: { queryClient: QueryClient } }) => Promise<void>;
	component: ComponentType;
	errorComponent: ComponentType<{ error: Error; reset: () => void }>;
	notFoundComponent: ComponentType;
}

/**
 * One of the tree's file routes, narrowed the same way.
 *
 * Every field is stated as present because each is read only on the route that
 * declares it, and no test reaches past that.
 */
interface FilePage {
	options: {
		component: ComponentType;
		notFoundComponent: ComponentType;
		head: () => { meta: { title: string }[] };
	};
}

interface SetupParams {
	/** The repository root the app is rendered against. */
	repoRoot?: string;
}

const setupRouteTree = ({ repoRoot = '/repos/lightsout' }: SetupParams = {}) => {
	mockRequireLocalRepoRoot.mockReturnValue(repoRoot);

	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const router = createRouter({ routeTree, context: { queryClient } });
	const pages = (router as unknown as { routesById: Record<string, FilePage> }).routesById;
	const rootPage = pages.__root__.options as unknown as RootPage;

	return { pages, queryClient, repoRoot, rootPage };
};

const setupRootPage = (params: SetupParams = {}) => {
	const { repoRoot, rootPage } = setupRouteTree(params);
	const Page = rootPage.component;

	renderWithQueryClient({
		ui: <Page />,
		seed: [{ queryKey: repoRootQueryOptions().queryKey, data: { repoRoot } }],
	});
};

const setupCaughtError = ({ message = 'the run manifest is unreadable' }: { message?: string } = {}) => {
	const { rootPage } = setupRouteTree();
	const Page = rootPage.errorComponent;

	renderWithQueryClient({ ui: <Page error={new Error(message)} reset={() => {}} /> });
};

const setupMissingPage = () => {
	const { rootPage } = setupRouteTree();
	const Page = rootPage.notFoundComponent;

	renderWithQueryClient({ ui: <Page /> });
};

const setupWorkOrdersPage = () => {
	const { pages } = setupRouteTree();
	const Page = pages['/app/'].options.component;

	renderWithQueryClient({ ui: <Page /> });
};

// The tree this file drives lives in `routeTree.gen.ts`, which TanStack Router
// writes and the repo lists as generated output — so it is not a subject a test
// may be named after. `router.tsx` is the tree's only consumer, which makes this
// a scenario suite on the router: what it serves, as opposed to how it is wired.
//
// The sell zone's standards routes and the two frames around the pages are
// concerns of their own and have their own suites beside this one; this file
// carries the rest of the shell and the local zone.
describe('routeTree', () => {
	// `/_site` and `/app` are the two frames. `/_site` carries no address of its
	// own — the pages under it are served at `/`, `/standards-packs` and the rest,
	// exactly where they always were — and which frame a page wears is settled by
	// which of the two it sits under.
	test('hangs one route off the root for every route file the app has, and nothing else', () => {
		const { pages } = setupRouteTree();

		const ids = Object.keys(pages).sort();

		expect(ids).toStrictEqual([
			'/_site',
			'/_site/',
			'/_site/commands/',
			'/_site/commands/$command',
			'/_site/docs/$doc',
			'/_site/standards-packs/',
			'/_site/standards-packs/$library/packs/$pack',
			'/_site/standards-packs/$library/rules/$rule',
			'/app',
			'/app/',
			'__root__',
		]);
	});

	test('serves pack and rule pages under their library and no rule-set pages', () => {
		const { pages } = setupRouteTree();

		const ids = Object.keys(pages);

		expect({
			packsPage: ids.includes('/_site/standards-packs/'),
			packPage: ids.includes('/_site/standards-packs/$library/packs/$pack'),
			rulePage: ids.includes('/_site/standards-packs/$library/rules/$rule'),
			ruleSetPages: ids.filter((id) => id.includes('$ruleSet')),
		}).toStrictEqual({
			packsPage: true,
			packPage: true,
			rulePage: true,
			ruleSetPages: [],
		});
	});

	test('names the page, declares its encoding and viewport, and links the stylesheet the app is themed with', () => {
		const { rootPage } = setupRouteTree();

		const head = rootPage.head();

		expect(head.meta).toStrictEqual([{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { title: 'lightsout' }]);
		expect(head.links).toStrictEqual([{ rel: 'stylesheet', href: appCssHref }]);
	});

	test('asks nothing of any repo at the root, so the public pages never do', () => {
		const { rootPage } = setupRouteTree();

		expect(rootPage.loader).toBeUndefined();
	});

	test('renders the page as an English HTML document', () => {
		setupRootPage();

		const page = document.querySelector('html[lang="en"]');

		expect(page).toBeInTheDocument();
	});

	test('sends that document light, so a first-time reader never sees the dark theme flash past', () => {
		setupRootPage();

		const page = document.querySelector('html[lang="en"]');

		expect(page?.className.split(' ')).toContain('light');
	});

	test('puts whichever route is open inside that document', () => {
		setupRootPage();

		const open = screen.getByText('the open route');

		expect(open).toBeInTheDocument();
	});

	test('shows what went wrong when a route throws', () => {
		setupCaughtError({ message: 'the run manifest is unreadable' });

		const message = screen.getByText('the run manifest is unreadable');

		expect(message).toBeInTheDocument();
	});

	test('offers a way back home for a path no route matches', () => {
		setupMissingPage();

		const back = screen.getByRole('link', { name: 'Back to home' });

		expect(back).toHaveAttribute('href', '/');
	});

	test('the landing route is the page that sells the product, and warms nothing', () => {
		const { pages } = setupRouteTree();

		// Narrowed the way the root's own options are above: the router types these
		// against its deeply generic route shapes, and this route declares a head
		// and deliberately no loader.
		const landing = pages['/_site/'].options as unknown as { head: () => { meta: { title?: string }[] }; loader?: unknown };

		expect(landing.head().meta[0].title).toBe('lightsout — Stop the slop.');
		expect(landing.loader).toBeUndefined();
	});

	test('the local zone opens on its work orders, and titles the tab after them', () => {
		const { pages } = setupRouteTree();

		const head = pages['/app/'].options.head();

		expect(head.meta).toStrictEqual([{ title: 'Work orders' }]);
	});

	test('the local zone’s landing route is the work orders page', () => {
		setupWorkOrdersPage();

		const heading = screen.getByRole('heading', { level: 1, name: 'Work orders' });

		expect(heading).toBeInTheDocument();
	});
});
