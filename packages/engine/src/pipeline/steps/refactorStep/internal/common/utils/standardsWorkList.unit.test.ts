import { describe, expect, jest, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { standardsWorkList } from '#src/pipeline/steps/refactorStep/internal/common/utils/standardsWorkList.ts';

// Mocked Imports
// -------------------------
// The check itself has its own tests; what this helper owns is the config and
// scope it hands the check, observable with the check stubbed.
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

/** A pipeline run carrying only what the work-list reads off it: its worktree, its config and the files it changed. */
const setupRun = () => {
	mockRunStandardsCheck.mockResolvedValue({ findings: [], notes: [] });

	const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false }, 'packages-dir': 'apps' };
	const manifest = { changedFiles: ['apps/web/src/index.ts'] } as unknown as RunManifest;
	const run = {
		cwd: '/tmp/lightsout-standards-work-list',
		config,
		current: () => manifest,
	} as unknown as PipelineRun;

	return { run, config };
};

describe('standardsWorkList', () => {
	test("checks the tree with the run's own config, never the file in the worktree", async () => {
		const { run, config } = setupRun();

		await standardsWorkList({ run, baseline: undefined });

		const handed = mockRunStandardsCheck.mock.calls[0]?.[0];

		expect({ ...handed, sameConfig: handed?.config === config }).toStrictEqual({
			cwd: '/tmp/lightsout-standards-work-list',
			config,
			persist: false,
			all: true,
			sameConfig: true,
		});
	});
});
