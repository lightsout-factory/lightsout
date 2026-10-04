import { describe, expect, jest, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RefactorWorklist } from '#src/contracts/refactor/RefactorWorklist.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { closeRefactorRun } from '#src/refactor/internal/closeRefactorRun.ts';
import type { RefactorRun } from '#src/refactor/internal/RefactorRun.ts';

// Mocked Imports
// -------------------------
// The standards check walks the tree and has its own tests; what the close
// owns is the scope and the config it hands the final re-check.
interface StandardsCheckParams {
	cwd: string;
	config: LightsoutConfig | undefined;
	path?: string;
	all?: boolean;
	writeBaseline?: boolean;
	persist?: boolean;
	onProgress?: (message: string) => void;
}

const mockRunStandardsCheck = jest.fn<(params: StandardsCheckParams) => Promise<{ findings: StandardsFinding[]; notes: string[] }>>();

jest.mock('#src/standardsCheck/runStandardsCheck.ts', () => ({
	runStandardsCheck: (params: StandardsCheckParams) => mockRunStandardsCheck(params),
}));
// -------------------------

/**
 * A RefactorRun stub carrying only what the close touches on a clean re-check:
 * the tree and config it checks with, and the passed stamp it writes.
 */
const setupCloseRefactorRun = ({ path, all }: { path: string; all: boolean }) => {
	mockRunStandardsCheck.mockResolvedValue({ findings: [], notes: [] });

	const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false }, 'packages-dir': 'packages' };
	const manifest = { runId: 'run-1', steps: [], currentStep: null } as unknown as RunManifest;
	const run = {
		cwd: '/repo',
		config,
		declined: [],
		before: {},
		current: () => manifest,
		update: async () => undefined,
	} as unknown as RefactorRun;
	const worklist: RefactorWorklist = { at: '2026-10-02T00:00:00.000Z', path, all, batches: [] };

	return { run, worklist };
};

describe('closeRefactorRun', () => {
	test.each([
		{ path: 'src/core', all: true, expectedPath: 'src/core' },
		{ path: '.', all: false, expectedPath: undefined },
	])("re-checks with the run's config at the worklist's scope", async ({ path, all, expectedPath }) => {
		const { run, worklist } = setupCloseRefactorRun({ path, all });

		await closeRefactorRun({ run, worklist });

		const checked = mockRunStandardsCheck.mock.calls[0]?.[0];

		expect({
			calls: mockRunStandardsCheck.mock.calls.length,
			cwd: checked?.cwd,
			sameConfig: checked?.config === run.config,
			path: checked?.path,
			all: checked?.all,
			persist: checked?.persist,
		}).toStrictEqual({ calls: 1, cwd: '/repo', sameConfig: true, path: expectedPath, all, persist: false });
	});
});
