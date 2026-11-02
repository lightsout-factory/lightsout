import { describe, expect, test } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { routeTree } from '#src/routeTree.gen.ts';

/**
 * The runs route's options, narrowed to what this file reads.
 *
 * The router types these against its own deeply generic route shapes; restating
 * those here would be noise rather than safety, so the one entry names only the
 * value the app's own code hands back.
 */
interface FilePage {
	options: {
		head: () => { meta: { title: string }[] };
	};
}

const setupRunsRoute = () => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const router = createRouter({ routeTree, context: { queryClient } });
	const pages = (router as unknown as { routesById: Record<string, FilePage> }).routesById;

	return { head: pages['/app/runs'].options.head };
};

// The tree this file drives lives in `routeTree.gen.ts`, which TanStack Router
// writes and the repo lists as generated output — so it is not a subject a test
// may be named after. `router.tsx` is the tree's only consumer, which makes this
// a scenario suite on the router: how the runs route names itself, as opposed
// to the shell and the local zone its sibling suite carries. What the route
// accepts from a URL is `parseRunsSearch`'s, tested beside that file.
describe('routeTree', () => {
	test('the runs route names the browser tab after the page it opens', () => {
		const { head } = setupRunsRoute();

		const meta = head().meta;

		expect(meta).toStrictEqual([{ title: 'Runs' }]);
	});
});
