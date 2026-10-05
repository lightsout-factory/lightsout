import { describe, expect, jest, test } from '@jest/globals';
import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { GateRunResult } from '#src/common/types/GateRunResult.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import { runDirectWork } from '#src/direct/runDirectWork/runDirectWork.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// Mocked Imports
// -------------------------
// The harness and the repo's gates are the two things a direct run drives, and
// each is another module's entry point with its own tests. Run state on disk is
// real, because a truthful, resumable record is what this run exists to leave.
const mockInvokeAgentWithContract =
	jest.fn<(params: { invocation: { prompt: string; systemPrompt: string }; allowedCommands?: string[] }) => Promise<AgentOutcome<WorkReport>>>();
const mockRunGates = jest.fn<(params: { step?: string; onProgress?: (message: string) => void }) => Promise<GateRunResult>>();

jest.mock('#src/invoke/invokeAgentWithContract/invokeAgentWithContract.ts', () => ({
	invokeAgentWithContract: (params: { invocation: { prompt: string; systemPrompt: string }; allowedCommands?: string[] }) =>
		mockInvokeAgentWithContract(params),
}));
jest.mock('#src/gates/runGates/runGates.ts', () => ({
	runGates: (params: { step?: string; onProgress?: (message: string) => void }) => mockRunGates(params),
}));
// -------------------------

const driver: Driver = { name: 'claude-code', invoke: () => Promise.resolve({ text: '', exitCode: 0 }) };

const reportOf = (overrides: Partial<WorkReport> = {}): WorkReport => ({
	status: WorkReportStatus.Complete,
	changedFiles: [{ path: 'src/thing.ts', summary: 'built it' }],
	summary: 'built it',
	failures: [],
	...overrides,
});

/** A consumer repo with the harness and the gates stubbed green. */
const setupDirectRun = () => {
	const cwd = setupConsumerRepo();
	const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

	mockInvokeAgentWithContract.mockResolvedValue({ ok: true, report: reportOf() });
	mockRunGates.mockResolvedValue({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined });

	const run = ({ onProgress }: { onProgress?: (message: string) => void } = {}) =>
		runDirectWork({
			cwd,
			ticketBody: '# Drain the backlog\n\nBuild the thing.',
			ticketRef: 'LO-70',
			driver,
			driverName: 'claude-code',
			config,
			loadedConfig: { config },
			onProgress,
		});

	return { cwd, run };
};

describe('runDirectWork', () => {
	test('stops before spending an agent when the repo is not green to begin with — a red gate then is not the agent’s doing', async () => {
		const { run } = setupDirectRun();

		mockRunGates.mockResolvedValue({ error: 'tsc: 3 errors', failedFamilies: ['check'], crashes: [], timeouts: [], coordination: undefined });

		const result = await run();

		expect(result.ok).toBe(false);
		expect(result.manifest.status).toBe(RunStatus.Failed);
		expect(mockInvokeAgentWithContract).not.toHaveBeenCalled();
	});

	test('re-invokes the worker with the gate output when verify comes back red, and passes once it is green', async () => {
		const { run } = setupDirectRun();

		mockRunGates
			.mockResolvedValueOnce({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined })
			.mockResolvedValueOnce({ error: 'tsc: 3 errors', failedFamilies: ['check'], crashes: [], timeouts: [], coordination: undefined })
			.mockResolvedValue({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined });

		const result = await run();

		expect(result.ok).toBe(true);
		expect(mockInvokeAgentWithContract).toHaveBeenCalledTimes(2);
		expect(mockInvokeAgentWithContract.mock.calls[1]?.[0].invocation.prompt).toContain('tsc: 3 errors');
	});

	test('gives up after the fix retries are spent, ending failed with the gate output as the reason', async () => {
		const { run } = setupDirectRun();

		mockRunGates
			.mockResolvedValueOnce({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined })
			.mockResolvedValue({ error: 'tsc: 3 errors', failedFamilies: ['check'], crashes: [], timeouts: [], coordination: undefined });

		const result = await run();

		expect(result.manifest.status).toBe(RunStatus.Failed);
		expect(result.error).toBe('tsc: 3 errors');
		expect(mockInvokeAgentWithContract).toHaveBeenCalledTimes(3);
	});

	test('runDirectWork: a gate run that never got the machine ends the run without spending a fix attempt', async () => {
		const { run } = setupDirectRun();
		const coordination = 'another run holds this machine: run 20260908-a in /tmp/trees/lo-71, held for 31m — waited 30m';

		mockRunGates
			.mockResolvedValueOnce({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined })
			.mockResolvedValue({ error: coordination, failedFamilies: [], crashes: [], timeouts: [], coordination });

		const result = await run();

		expect(result.manifest.status).toBe(RunStatus.Escalated);
		expect(result.error).toContain(coordination);
		expect(result.error).toContain('No fix was attempted and no fix attempt was spent');
		expect(mockInvokeAgentWithContract).toHaveBeenCalledTimes(1);
		// one verify attempt on the record too: the run stopped at the first gate
		// run rather than counting a fix round it never spent
		expect(result.manifest.steps.filter((step) => step.id === 'verify')).toEqual([
			expect.objectContaining({ id: 'verify', status: RunStatus.Escalated, attempts: 1 }),
		]);
	});

	test('names the machine rather than a crash when a gate run that never started also reported one, because it produced no output to attribute a crash to', async () => {
		const { run } = setupDirectRun();
		const coordination = 'another run holds this machine: run 20260908-a in /tmp/trees/lo-71, held for 31m — waited 30m';

		mockRunGates.mockResolvedValueOnce({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined }).mockResolvedValue({
			error: 'signal=SIGSEGV',
			failedFamilies: [],
			crashes: ['gate [root] testCoverage never returned a verdict'],
			timeouts: [],
			coordination,
		});

		const result = await run();

		expect(result.error).toContain(coordination);
		expect(result.error).not.toContain('a gate crashed instead of failing');
	});

	test('stops without spending a fix attempt when a gate crashed rather than failed, so no worker is sent at a suite that is not broken', async () => {
		const { run } = setupDirectRun();

		mockRunGates.mockResolvedValueOnce({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined }).mockResolvedValue({
			error: 'signal=SIGSEGV',
			failedFamilies: [],
			crashes: ['gate [root] testCoverage never returned a verdict'],
			timeouts: [],
			coordination: undefined,
		});

		const result = await run();

		expect(result.manifest.status).toBe(RunStatus.Escalated);
		expect(result.error).toContain('gate [root] testCoverage never returned a verdict');
		expect(result.error).toContain('No fix was attempted and no fix attempt was spent');
		expect(mockInvokeAgentWithContract).toHaveBeenCalledTimes(1);
	});

	test('runDirectWork: a gate that ran past its ceiling ends the run without spending a fix attempt', async () => {
		const { run } = setupDirectRun();
		const timeout = 'test timed out: every attempt ran past the 15-minute gate ceiling (timeouts.gate-minutes), so this gate never returned a verdict.';

		mockRunGates.mockResolvedValueOnce({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined }).mockResolvedValue({
			error: 'test: exit -1 (timeout at the 15-minute ceiling)',
			failedFamilies: [],
			crashes: [],
			timeouts: [timeout],
			coordination: undefined,
		});

		const result = await run();

		expect(result.manifest.status).toBe(RunStatus.Escalated);
		expect(result.error).toContain(timeout);
		expect(mockInvokeAgentWithContract).toHaveBeenCalledTimes(1);
		// one verify attempt on the record: the run stopped at the first gate run
		// rather than counting a fix round it never spent
		expect(result.manifest.steps.filter((step) => step.id === 'verify')).toEqual([
			expect.objectContaining({ id: 'verify', status: RunStatus.Escalated, attempts: 1 }),
		]);
	});

	test('relays what the verify gates report back to the caller, so the terminal shows the gate that is running', async () => {
		const { run } = setupDirectRun();
		const progress: string[] = [];

		mockRunGates.mockImplementation(({ step, onProgress }) => {
			onProgress?.(`${step} is running`);

			return Promise.resolve({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined });
		});

		await run({ onProgress: (message) => progress.push(message) });

		expect(progress).toContain('verify is running');
	});
});
