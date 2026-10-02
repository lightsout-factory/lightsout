import { describe, expect, jest, test } from '@jest/globals';
import type { AcceptanceRow } from '#src/common/types/AcceptanceRow.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { ApprovedTestRecord } from '#src/contracts/run/ApprovedTestRecord.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { StandardsSnapshot } from '#src/contracts/standardsCheck/StandardsSnapshot.ts';
import type { VerificationResult } from '#src/pipeline/internal/common/types/VerificationResult.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { buildSteps } from '#src/pipeline/steps/buildSteps/buildSteps.ts';

// Mocked Imports
// -------------------------
interface GateParams {
	run: PipelineRun;
	coverage?: boolean;
	checkpoint: string;
	rows: AcceptanceRow[];
	final?: boolean;
}

const mockRunVerificationGates = jest.fn<(params: GateParams) => Promise<VerificationResult>>();

jest.mock('#src/pipeline/internal/common/utils/runVerificationGates.ts', () => ({
	runVerificationGates: (params: GateParams) => mockRunVerificationGates(params),
}));
// -------------------------
const mockReadGitChangedFiles = jest.fn<(params: { cwd: string }) => Promise<string[] | undefined>>();

jest.mock('#src/common/git/readGitChangedFiles.ts', () => ({
	readGitChangedFiles: (params: { cwd: string }) => mockReadGitChangedFiles(params),
}));
// -------------------------
const mockApproveTestFiles = jest.fn<(params: { run: PipelineRun; paths: string[] }) => Promise<ApprovedTestRecord[]>>();

jest.mock('#src/pipeline/approvedTests/approveTestFiles.ts', () => ({
	approveTestFiles: (params: { run: PipelineRun; paths: string[] }) => mockApproveTestFiles(params),
}));
// -------------------------
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
const mockWriteRunStandardsBaseline = jest.fn<(params: { cwd: string; runId: string; snapshot: StandardsSnapshot }) => Promise<void>>();

jest.mock('#src/runState/standardsBaseline/writeRunStandardsBaseline.ts', () => ({
	writeRunStandardsBaseline: (params: { cwd: string; runId: string; snapshot: StandardsSnapshot }) => mockWriteRunStandardsBaseline(params),
}));
// -------------------------

const planContent = '# Widget\n\n## Context\n\nAdds a widget.\n';

/**
 * A PipelineRun stub for a clean-slate that reaches its passed stamp: green
 * gates, a dirty tree as git reports it, and the patch the step writes captured
 * so the baseline and the approvals can be read back.
 */
const setupBuildSteps = ({ generated, dirtyFiles }: { generated: string[] | undefined; dirtyFiles: string[] }) => {
	mockRunVerificationGates.mockResolvedValue({
		error: undefined,
		failedFamilies: [],
		crashes: [],
		timeouts: [],
		coordination: undefined,
		failures: [],
		gates: [],
	});
	mockReadGitChangedFiles.mockResolvedValue(dirtyFiles);
	mockApproveTestFiles.mockImplementation(async ({ paths }) => paths.map((path) => ({ path, sha256: 'a'.repeat(64), removed: false })));
	mockRunStandardsCheck.mockResolvedValue({ findings: [], notes: [] });
	mockWriteRunStandardsBaseline.mockResolvedValue(undefined);

	const manifest = {
		runId: 'run-1',
		steps: [],
		changedFiles: [],
		packages: [],
		baselineDirtyFiles: dirtyFiles,
		approvedTests: [],
		acceptanceTests: [],
		currentStep: null,
	} as unknown as RunManifest;
	const patches: Partial<RunManifest>[] = [];

	const run = {
		cwd: '/tmp/lightsout-build-steps',
		config: { gates: {}, ...(generated === undefined ? {} : { generated }) } as unknown as LightsoutConfig,
		current: () => manifest,
		progress: () => undefined,
		nextRecord: ({ id }: { id: string }) => ({ id, status: RunStatus.Running, attempts: 1 }),
		setStep: async ({ record, patch }: { record: StepRecord; patch?: Partial<RunManifest> }) => {
			manifest.steps = [record];

			if (patch) {
				patches.push(patch);
			}
		},
	};

	return { run: run as unknown as PipelineRun, patches };
};

describe('buildSteps', () => {
	test.each([
		{ scope: 'outside the configured generated entry', generated: ['dist/'], approved: ['src/widget.unit.test.ts'] },
		{ scope: 'anywhere when no generated entries are configured', generated: undefined, approved: ['dist/widget.unit.test.js', 'src/widget.unit.test.ts'] },
	])('its clean-slate step keeps every dirty file in the baseline and approves test files $scope', async ({ generated, approved }) => {
		const { run, patches } = setupBuildSteps({ generated, dirtyFiles: ['dist/widget.unit.test.js', 'src/widget.unit.test.ts'] });

		const steps = buildSteps({ run, planContent });
		const cleanSlate = steps.find((step) => step.id === 'clean-slate');
		const outcome = await cleanSlate?.run();

		expect({
			outcome,
			approvedPaths: mockApproveTestFiles.mock.calls.map(([params]) => params.paths),
			baselineDirtyFiles: patches.at(-1)?.baselineDirtyFiles,
		}).toStrictEqual({
			outcome: undefined,
			approvedPaths: [approved],
			baselineDirtyFiles: ['dist/widget.unit.test.js', 'src/widget.unit.test.ts'],
		});
	});
});
