import { describe, expect, jest, test } from '@jest/globals';
import { removeRunOwner } from '#src/runState/owner/removeRunOwner.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

// Mocked Imports
// -------------------------
// A run lookup fails with anything but "no such run" only when the checkout
// itself cannot be read, which no temporary repository can stage on demand.
const mockGetRunOwnerPath = jest.fn<(params: { cwd: string; runId: string }) => Promise<string>>();

jest.mock('#src/runState/owner/common/getRunOwnerPath.ts', () => ({
	getRunOwnerPath: (params: { cwd: string; runId: string }) => mockGetRunOwnerPath(params),
}));
// -------------------------

const setupFailingLookup = () => {
	mockGetRunOwnerPath.mockRejectedValue(new Error('EACCES: permission denied, scandir .lightsout'));

	return { cwd: '/repo', runId: 'run-owned' };
};

describe('removeRunOwner', () => {
	test('passes on a lookup failure that is not a missing run', async () => {
		const { cwd, runId } = setupFailingLookup();

		const error = await getRejectionError({ promise: removeRunOwner({ cwd, runId }) });

		// only "no run yet" means there is nothing to remove; anything else is the caller's to see
		expect(error.message).toContain('EACCES');
	});
});
