import { afterEach, describe, expect, jest, test } from '@jest/globals';
import type { RunListing, StandardsView } from '@lightsout/engine';
import { QueryClient } from '@tanstack/react-query';
import { createRouter, isNotFound } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { Theme } from '#src/common/constants/Theme.ts';
import { routeTree } from '#src/routeTree.gen.ts';
import { ThemeProvider } from '#src/theme/ThemeProvider.tsx';
import { buildRunListing } from '#tests/helpers/buildRunListing.ts';
import { buildStandardsView } from '#tests/helpers/buildStandardsView.ts';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
// The route tree loads every route module and everything those modules render,
// and the runs route reaches the engine's filesystem reader at the far end of
// that chain. Stubbing the reader keeps the whole graph off disk.
const mockListRuns = jest.fn<() => Promise<RunListing[]>>();
const mockGetStandards = jest.fn<() => Promise<StandardsView>>();

jest.mock('#src/lightsout/getReader.ts', () => ({
	getReader: () => ({
		listRuns: () => mockListRuns(),
		getStandards: () => mockGetStandards(),
		getFriction: () => Promise.resolve([]),
		listPlanWorkspaces: () => Promise.resolve([]),
	}),
}));
// -------------------------
// Which repo is open is answered by walking the real filesystem, so the app
// frame would otherwise report whatever directory Jest happened to start in.
// Only the walk is stood in for: whether the site is public is the real
// `isPublicDeployment`, read from the variable each test sets.
const mockRequireLocalRepoRoot = jest.fn<() => string>();

jest.mock('#src/common/utils/requireLocalRepoRoot.ts', () => ({
	requireLocalRepoRoot: () => mockRequireLocalRepoRoot(),
}));
// -------------------------
// The runs page holds its filters in the URL, and outside a live router there is
// nothing to read them from or navigate with.
const mockNavigate = jest.fn<(options: { search: Record<string, unknown>; replace: boolean }) => void>();
const mockSearch: Record<string, unknown> = {};
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
		useRouter: () => ({ invalidate: () => Promise.resolve() }),
		useSearch: () => mockSearch,
		useNavigate: () => mockNavigate,
	};
});
// -------------------------

/**
 * One of the tree's file routes, narrowed to what this file reads.
 *
 * The router types these against its own deeply generic route shapes; restating
 * those here would be noise rather than safety, so each entry names only the
 * argument the app's own code passes it and the value it hands back.
 */
interface FilePage {
	options: {
		component: ComponentType;
		beforeLoad: (input: { context: { queryClient: QueryClient } }) => Promise<void>;
	};
}

interface SetupParams {
	runs?: RunListing[];
	/** The repository root the app is rendered against. */
	repoRoot?: string;
}

const setupRouteTree = ({ runs = [buildRunListing()], repoRoot = '/repos/lightsout' }: SetupParams = {}) => {
	mockListRuns.mockResolvedValue(runs);
	mockGetStandards.mockResolvedValue(buildStandardsView());
	mockRequireLocalRepoRoot.mockReturnValue(repoRoot);

	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const router = createRouter({ routeTree, context: { queryClient } });
	const pages = (router as unknown as { routesById: Record<string, FilePage> }).routesById;

	return { pages, queryClient, repoRoot, runs };
};

/** The app frame's gate, on a local dev server or on the public site. */
const setupAppGate = ({ publicSite = false }: { publicSite?: boolean } = {}) => {
	const { pages, queryClient, repoRoot } = setupRouteTree({ repoRoot: '/repos/other-project' });

	if (publicSite) {
		process.env.LIGHTSOUT_PUBLIC = '1';
	}

	return { beforeLoad: pages['/app'].options.beforeLoad, queryClient, repoRoot };
};

/** What a gate threw, so a test can assert on a refusal that is not an `Error`. */
const catchRefusal = async ({ attempt }: { attempt: () => Promise<void> }): Promise<unknown> => {
	try {
		await attempt();
	} catch (error) {
		return error;
	}

	throw new Error('the gate let the load through where it should have refused');
};

/** One of the two frames — `/_site` or `/app` — with a route open inside it. */
const setupFrame = ({ id, ...params }: SetupParams & { id: string }) => {
	const { pages, repoRoot, runs } = setupRouteTree(params);
	const Frame = pages[id].options.component;

	renderWithQueryClient({
		// The frames carry the theme control, which the root route's provider wraps
		// in the running app; rendering one on its own has to supply it.
		ui: (
			<ThemeProvider defaultTheme={Theme.Dark}>
				<Frame />
			</ThemeProvider>
		),
		seed: [
			{ queryKey: [QueryKey.RepoRoot], data: { repoRoot } },
			{ queryKey: [QueryKey.Runs], data: runs },
		],
	});
};

/** The landing page, with the site frame around it — every link a public visitor starts from. */
const setupLandingInFrame = () => {
	const { pages } = setupRouteTree();
	const Frame = pages['/_site'].options.component;
	const Landing = pages['/_site/'].options.component;

	renderWithQueryClient({
		ui: (
			<ThemeProvider defaultTheme={Theme.Dark}>
				<Frame />
				<Landing />
			</ThemeProvider>
		),
	});
};

// The tree this file drives lives in `routeTree.gen.ts`, which TanStack Router
// writes and the repo lists as generated output — so it is not a subject a test
// may be named after. `router.tsx` is the tree's only consumer, which makes this
// a scenario suite on the router, split from the tree's own by concern: the two
// frames every page sits in, and the gate that keeps the app frame off the
// public site.
afterEach(() => {
	delete process.env.LIGHTSOUT_PUBLIC;
	jest.clearAllMocks();
});

describe('routeTree frames', () => {
	test('fetches which repo is open before any app page loads, leaving run state to the pages that show it', async () => {
		const { beforeLoad, queryClient, repoRoot } = setupAppGate();

		await beforeLoad({ context: { queryClient } });

		expect({ repoRoot: queryClient.getQueryData([QueryKey.RepoRoot]), runs: queryClient.getQueryData([QueryKey.Runs]) }).toStrictEqual({
			repoRoot: { repoRoot },
			runs: undefined,
		});
	});

	test('answers not-found for the whole app on the public site, before any page under it loads', async () => {
		const { beforeLoad, queryClient } = setupAppGate({ publicSite: true });

		const refusal = await catchRefusal({ attempt: () => beforeLoad({ context: { queryClient } }) });

		expect(isNotFound(refusal)).toBe(true);
	});

	test('asks the server nothing on the public site, so not even the repo root is fetched', async () => {
		const { beforeLoad, queryClient } = setupAppGate({ publicSite: true });

		await catchRefusal({ attempt: () => beforeLoad({ context: { queryClient } }) });

		expect(mockRequireLocalRepoRoot).not.toHaveBeenCalled();
	});

	test('gives the app frame the local zone when a repo was found', () => {
		setupFrame({ id: '/app', repoRoot: '/repos/other-project' });

		const zone = screen.getByRole('navigation', { name: 'Your repo' });

		expect(zone.textContent).toContain('Runs');
	});

	test('leaves the local zone out of the site frame, so the landing page is not wearing a sidebar', () => {
		setupFrame({ id: '/_site', repoRoot: '/repos/other-project' });

		const zone = screen.queryByRole('navigation', { name: 'Your repo' });

		expect(zone).not.toBeInTheDocument();
	});

	test('offers the public pages no way into the app, even with a repo found, since they never read one', () => {
		setupFrame({ id: '/_site', repoRoot: '/repos/other-project' });

		const app = screen.queryByRole('link', { name: 'App' });

		expect(app).not.toBeInTheDocument();
	});

	test('links nowhere into the app from the landing page or the frame around it', () => {
		setupLandingInFrame();

		const hrefs = screen.queryAllByRole('link').map((link) => link.getAttribute('href') ?? '');

		// The site's own links are counted too, so an empty render cannot pass as a page with no way into the app.
		expect({ sitePages: hrefs.includes('/commands'), intoApp: hrefs.filter((href) => href.startsWith('/app')) }).toStrictEqual({
			sitePages: true,
			intoApp: [],
		});
	});
});
