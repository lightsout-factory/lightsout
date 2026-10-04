import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { resolveRunDir } from '#src/common/runs/resolveRunDir.ts';
import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { GateRunResult } from '#src/common/types/GateRunResult.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import { runDirectWork } from '#src/direct/runDirectWork/runDirectWork.ts';
import { createRun } from '#src/runState/createRun.ts';
import { getRunOwnerPath } from '#src/runState/owner/common/getRunOwnerPath.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
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

	const run = ({ runId, ticketBody = '# Drain the backlog\n\nBuild the thing.' }: { runId?: string; ticketBody?: string } = {}) =>
		runDirectWork({
			cwd,
			ticketBody,
			ticketRef: 'LO-70',
			driver,
			driverName: 'claude-code',
			config,
			loadedConfig: { config },
			runId,
		});

	return { cwd, run };
};

/**
 * A consumer repo already holding a parked direct run, ready to be continued:
 * the run exists on disk with its own id and its own recorded baseline, and
 * the tree it left behind is the partial work a resume must keep.
 */
const setupContinuedDirectRun = async () => {
	const cwd = setupConsumerRepo();
	const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

	mockInvokeAgentWithContract.mockResolvedValue({ ok: true, report: reportOf() });
	mockRunGates.mockResolvedValue({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined });

	const existing = await createRun({
		cwd,
		plan: 'ticket.md',
		pipeline: PipelineKind.Direct,
		ticketRef: 'LO-70',
		driver: 'claude-code',
		loadedConfig: { config },
		baselineDirtyFiles: ['src/half-done.ts'],
	});

	const run = () =>
		runDirectWork({
			cwd,
			ticketBody: '# Drain the backlog\n\nBuild the thing.',
			ticketRef: 'LO-70',
			driver,
			driverName: 'claude-code',
			config,
			loadedConfig: { config },
			existing,
		});

	return { cwd, existing, run };
};

/**
 * A consumer repo with the harness and the gates stubbed green, building as a
 * queue worker: the queue run `q-1` is the one whose owner record answers for
 * the run this build creates.
 */
const setupQueueWorkerDirectRun = () => {
	const cwd = setupConsumerRepo();
	const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

	mockInvokeAgentWithContract.mockResolvedValue({ ok: true, report: reportOf() });
	mockRunGates.mockResolvedValue({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined });

	const run = () =>
		runDirectWork({
			cwd,
			ticketBody: '# Drain the backlog\n\nBuild the thing.',
			ticketRef: 'LO-70',
			driver,
			driverName: 'claude-code',
			config,
			loadedConfig: { config },
			queueRunId: 'q-1',
		});

	return { cwd, run };
};

/**
 * A parked direct run whose owner record still names the process that worked
 * on it before — pid 999999, long gone — ready to be continued by this one.
 */
const setupContinuedDirectRunOwnedElsewhere = async () => {
	const continued = await setupContinuedDirectRun();
	const ownerPath = await getRunOwnerPath({ cwd: continued.cwd, runId: continued.existing.runId });

	writeFileSync(ownerPath, JSON.stringify({ pid: 999999, recordedAt: '2026-09-29T09:00:00.000Z' }));

	return continued;
};

describe('runDirectWork', () => {
	test('a continued direct run reuses its run and skips the pre-flight the partial tree would fail', async () => {
		const { cwd, existing, run } = await setupContinuedDirectRun();

		const result = await run();

		expect(result.manifest).toEqual(expect.objectContaining({ runId: existing.runId, baselineDirtyFiles: ['src/half-done.ts'], status: RunStatus.Passed }));
		// a direct run of a ticket is filed under the ticket's own runs folder
		expect(readdirSync(dirname(runDirFor({ cwd, runId: existing.runId, workOrderName: existing.branch })))).toStrictEqual([existing.runId]);
		expect(mockRunGates.mock.calls.map((call) => call[0].step)).toStrictEqual(['verify']);
		expect(mockInvokeAgentWithContract).toHaveBeenCalledTimes(1);
	});

	test('a first direct run still mints its run and still refuses a red baseline', async () => {
		const { cwd, run } = setupDirectRun();

		mockRunGates.mockResolvedValue({ error: 'tsc: 3 errors', failedFamilies: ['check'], crashes: [], timeouts: [], coordination: undefined });

		const result = await run();

		expect(result.ok).toBe(false);
		expect(result.manifest.status).toBe(RunStatus.Failed);
		expect(readdirSync(dirname(runDirFor({ cwd, runId: result.manifest.runId, workOrderName: result.manifest.branch })))).toStrictEqual([
			result.manifest.runId,
		]);
		expect(mockRunGates.mock.calls.map((call) => call[0].step)).toStrictEqual(['pre-flight']);
		expect(mockInvokeAgentWithContract).not.toHaveBeenCalled();
	});

	test('creates a fresh direct run under the run id it is given', async () => {
		const ticketBody = '# Drain the backlog\n\nBuild the thing.';
		const { cwd, run } = setupDirectRun();

		const result = await run({ runId: '20260912-pre-minted', ticketBody });

		// the id the caller minted is the run that exists, so a ticket record
		// naming it names a run on disk
		expect(result.manifest.runId).toBe('20260912-pre-minted');
		expect(readdirSync(dirname(runDirFor({ cwd, runId: '20260912-pre-minted', workOrderName: result.manifest.branch })))).toStrictEqual([
			'20260912-pre-minted',
		]);
		expect(readFileSync(join(await resolveRunDir({ cwd, runId: '20260912-pre-minted' }), 'ticket.md'), 'utf8')).toBe(`${ticketBody}\n`);
	});

	test('points a fresh queue worker direct run at the queue run', async () => {
		const { cwd, run } = setupQueueWorkerDirectRun();

		const result = await run();
		const owner = await readRunOwner({ cwd, runId: result.manifest.runId });

		expect(owner).toStrictEqual({ queueRunId: 'q-1' });
	});

	test("replaces a continued direct run's owner record with the resuming process", async () => {
		const { cwd, existing, run } = await setupContinuedDirectRunOwnedElsewhere();

		await run();
		const owner = await readRunOwner({ cwd, runId: existing.runId });

		expect(owner).toEqual(expect.objectContaining({ pid: process.pid, recordedAt: expect.any(String) }));
	});
});
