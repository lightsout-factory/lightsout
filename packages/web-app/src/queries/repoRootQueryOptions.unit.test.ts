import { describe, expect, jest, test } from '@jest/globals';
import { repoRootQueryOptions } from '#src/queries/repoRootQueryOptions.ts';

// Mocked Imports
// -------------------------
// The gate, not the server function in front of it. Under Jest the Start stub
// hands `handler()` straight back, so the real `getRepoRootServerFn` runs and
// the fetcher is proved down to the one call that decides what it answers.
// What the transport does with that handler is the build's business.
const mockRequireLocalRepoRoot = jest.fn<() => string>();

jest.mock('#src/server/requireLocalRepoRoot.ts', () => ({
	requireLocalRepoRoot: () => mockRequireLocalRepoRoot(),
}));
// -------------------------

const setupRepoRootQueryOptions = ({ refusal }: { refusal?: Error } = {}) => {
	mockRequireLocalRepoRoot.mockImplementation(() => {
		if (refusal !== undefined) {
			throw refusal;
		}

		return '/repos/lightsout';
	});

	const options = repoRootQueryOptions();
	// TanStack types the fetcher against its own QueryFunctionContext generic;
	// this one takes no context, and restating that generic would add noise.
	const fetchRepoRoot = options.queryFn as unknown as () => Promise<{ repoRoot: string }>;

	return { fetchRepoRoot, options };
};

describe('repoRootQueryOptions', () => {
	test('keys the cache under the repo-root key', () => {
		const { options } = setupRepoRootQueryOptions();

		expect(options.queryKey).toStrictEqual(['repoRoot']);
	});

	test('fetches through the repo-root server function', async () => {
		const { fetchRepoRoot } = setupRepoRootQueryOptions();

		const result = await fetchRepoRoot();

		expect(result).toStrictEqual({ repoRoot: '/repos/lightsout' });
	});

	test("lets the gate's refusal travel as itself, so the app frame shows the message naming the fix", async () => {
		const refusal = new Error('No lightsout.config.json was found');
		const { fetchRepoRoot } = setupRepoRootQueryOptions({ refusal });

		const result = fetchRepoRoot();

		await expect(result).rejects.toBe(refusal);
	});
});
