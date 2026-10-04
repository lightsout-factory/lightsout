import { describe, expect, jest, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { createSiteChecker } from '#src/refactor/batch/runBatch/createBatchTools/createSiteChecker.ts';

// Mocked Imports
// -------------------------
// The standards check walks the tree and has its own tests; what the checker
// owns is the config, scope and mode it hands every re-check.

interface RunStandardsCheckParams {
	cwd: string;
	config: LightsoutConfig | undefined;
	path?: string;
	all?: boolean;
	writeBaseline?: boolean;
	persist?: boolean;
	onProgress?: (message: string) => void;
}

const mockRunStandardsCheck = jest.fn<(params: RunStandardsCheckParams) => Promise<{ findings: StandardsFinding[]; notes: string[] }>>();

jest.mock('#src/standardsCheck/runStandardsCheck.ts', () => ({
	runStandardsCheck: (params: RunStandardsCheckParams) => mockRunStandardsCheck(params),
}));
// -------------------------

const setupSiteChecker = () => {
	mockRunStandardsCheck.mockResolvedValue({ findings: [], notes: [] });

	const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false }, 'packages-dir': 'apps' };
	const checker = createSiteChecker({ cwd: '/repo', config, checkPath: 'src/core', checkAll: true });

	return { checker, config };
};

describe('createSiteChecker', () => {
	test('re-checks every site with the config it was created with', async () => {
		const { checker, config } = setupSiteChecker();

		await Promise.all([checker.checkLive(), checker.remainingSiteKeys({ frozen: [] })]);

		expect(mockRunStandardsCheck.mock.calls.map(([params]) => ({ ...params, sameConfig: params.config === config }))).toStrictEqual([
			{ cwd: '/repo', config, path: 'src/core', all: true, persist: false, sameConfig: true },
			{ cwd: '/repo', config, path: 'src/core', all: true, persist: false, sameConfig: true },
		]);
	});
});
