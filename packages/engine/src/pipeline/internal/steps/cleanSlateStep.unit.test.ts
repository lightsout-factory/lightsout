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
import { cleanSlateStep } from '#src/pipeline/internal/steps/cleanSlateStep.ts';

// Mocked Imports
// -------------------------
// The gates are the one thing this step reads a verdict from, and they have
// their own tests. What is under test here is what the step does with a
// verdict, so the verdict is handed to it directly.
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

/**
 * A PipelineRun stub carrying only what clean-slate touches before it answers:
 * the manifest it reads, the progress it prints, and a stop that is captured
 * rather than thrown.
 */
const setupCleanSlateRun = ({ result }: { result: VerificationResult }) => {
	mockRunVerificationGates.mockResolvedValue(result);

	const manifest = {
		runId: 'run-1',
		steps: [],
		changedFiles: [],
		packages: [],
		baselineDirtyFiles: [],
		approvedTests: [],
		currentStep: null,
	} as unknown as RunManifest;
	const progress: string[] = [];
	let stopped: { status: RunStatus; error: string } | undefined;

	const run = {
		cwd: '/tmp/lightsout-clean-slate',
		config: {} as unknown as LightsoutConfig,
		current: () => manifest,
		progress: (message: string) => progress.push(message),
		nextRecord: ({ id }: { id: string }) => ({ id, status: RunStatus.Running, attempts: 1 }),
		setStep: async ({ record }: { record: StepRecord }) => {
			manifest.steps = [record];
		},
		stop: async ({ record, status, error }: { record: StepRecord; status: RunStatus; error: string }) => {
			stopped = { status, error };
			manifest.steps = [{ ...record, status, error }];

			return { ok: false as const, manifest, error };
		},
	};

	return { run: run as unknown as PipelineRun, progress, steps: () => manifest.steps, stopped: () => stopped };
};

/**
 * A PipelineRun stub for a clean-slate that reaches its passed stamp: green
 * gates, a dirty tree as git reports it, and the patch the step writes captured
 * so the baseline and the approvals can be read back.
 */
const setupPassingCleanSlateRun = ({ generated, dirtyFiles }: { generated: string[]; dirtyFiles: string[] }) => {
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
	// The package's jest config does not clear mocks between tests, so the
	// approvals this test reads back start from none.
	mockApproveTestFiles.mockReset();
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
		currentStep: null,
	} as unknown as RunManifest;
	const patches: Partial<RunManifest>[] = [];

	const run = {
		cwd: '/tmp/lightsout-clean-slate',
		config: { generated } as unknown as LightsoutConfig,
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

describe('cleanSlateStep', () => {
	test('cleanSlateStep: a coordination failure stops escalated instead of calling the codebase not green', async () => {
		const coordination = 'gates never started: run run-7 in /tmp/worktrees/lo-118 has held the machine for 31m, and this run waited its full 30m for it';
		const { run, steps, stopped } = setupCleanSlateRun({
			result: { error: coordination, failedFamilies: [], crashes: [], timeouts: [], coordination, failures: [], gates: [] },
		});

		const outcome = await cleanSlateStep({ run, ledgerGates: [] })();

		// No gate command executed, so the run has no evidence at all about the
		// consumer's code: it escalates naming the machine rather than failing
		// with the headline that says the codebase is not green.
		expect(stopped()).toEqual(expect.objectContaining({ status: RunStatus.Escalated }));
		expect(outcome?.error).toEqual(expect.stringContaining(coordination));
		expect(outcome?.error).not.toMatch(/not green before implementation/i);
		expect(steps()[0]).toEqual(expect.objectContaining({ id: 'clean-slate', status: RunStatus.Escalated }));
	});

	test('cleanSlateStep: a timed-out gate reads as a gate that did not finish, not a red codebase', async () => {
		const timeout = 'check timed out: every attempt ran past the 15-minute gate ceiling (timeouts.gate-minutes), so this gate never returned a verdict.';
		const { run, steps, stopped } = setupCleanSlateRun({
			result: { error: timeout, failedFamilies: [], crashes: [], timeouts: [timeout], coordination: undefined, failures: [], gates: [] },
		});

		const outcome = await cleanSlateStep({ run, ledgerGates: [] })();

		// A timed-out gate never reaches `failures`, so no exit -1 is there to find:
		// the step has to read the `timeouts` channel to know the gate never finished.
		expect(stopped()).toEqual(expect.objectContaining({ status: RunStatus.Failed }));
		expect(outcome?.error).toMatch(/did not finish/i);
		expect(outcome?.error).not.toMatch(/not green before implementation/i);
		expect(outcome?.error).toEqual(expect.stringContaining(timeout));
		expect(steps()[0]).toEqual(expect.objectContaining({ id: 'clean-slate', status: RunStatus.Failed }));
	});

	test('cleanSlateStep: carried build output is kept in the baseline but never approved as a test edit', async () => {
		const { run, patches } = setupPassingCleanSlateRun({
			generated: ['dist/'],
			dirtyFiles: ['dist/widget.unit.test.js', 'src/widget.unit.test.ts'],
		});

		const outcome = await cleanSlateStep({ run, ledgerGates: [] })();

		// A test file under a generated entry is build output a previous phase
		// left on disk, never an agent's test edit: it stays in the baseline so
		// it is not attributed to the run, but it gets no approved copy.
		expect({
			outcome,
			approvedPaths: mockApproveTestFiles.mock.calls.map(([params]) => params.paths),
			baselineDirtyFiles: patches.at(-1)?.baselineDirtyFiles,
		}).toStrictEqual({
			outcome: undefined,
			approvedPaths: [['src/widget.unit.test.ts']],
			baselineDirtyFiles: ['dist/widget.unit.test.js', 'src/widget.unit.test.ts'],
		});
	});

	test("captures the pre-edit standards baseline with the run's own config", async () => {
		const { run } = setupPassingCleanSlateRun({ generated: [], dirtyFiles: [] });

		await cleanSlateStep({ run, ledgerGates: [] })();

		// The package's jest config does not clear mocks between tests, so the
		// baseline check this run made is the latest call. The config must be the
		// run's own object, never one read again from the tree under the run.
		const params = mockRunStandardsCheck.mock.calls.at(-1)?.[0];

		expect({
			cwd: params?.cwd,
			sameConfig: params?.config === run.config,
			persist: params?.persist,
			all: params?.all,
		}).toStrictEqual({
			cwd: '/tmp/lightsout-clean-slate',
			sameConfig: true,
			persist: false,
			all: true,
		});
	});
});
