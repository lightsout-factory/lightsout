import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { resolveRunDir } from '#src/common/runs/resolveRunDir.ts';
import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { GateRunResult } from '#src/common/types/GateRunResult.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import { runDirectWork } from '#src/direct/runDirectWork/runDirectWork.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { getRunProgress } from '#src/views/getRunProgress.ts';
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

/**
 * A consumer repo with the harness and the gates stubbed green.
 *
 * `agentCommands` is what a consumer granted the worker of its own, which the
 * run adds its self-check prefix to; left out, the consumer granted none.
 */
const setupDirectRun = ({ agentCommands }: { agentCommands?: string[] } = {}) => {
	const cwd = setupConsumerRepo();
	const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false }, 'agent-commands': agentCommands };

	mockInvokeAgentWithContract.mockResolvedValue({ ok: true, report: reportOf() });
	mockRunGates.mockResolvedValue({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined });

	const run = ({
		answeredQuestion,
		onProgress,
		runId,
		ticketBody = '# Drain the backlog\n\nBuild the thing.',
		willShip,
	}: {
		answeredQuestion?: { question: string; answer: string };
		onProgress?: (message: string) => void;
		runId?: string;
		ticketBody?: string;
		willShip?: boolean;
	} = {}) =>
		runDirectWork({
			cwd,
			ticketBody,
			ticketRef: 'LO-70',
			driver,
			driverName: 'claude-code',
			config,
			loadedConfig: { config },
			answeredQuestion,
			runId,
			willShip,
			onProgress,
		});

	return { cwd, run };
};

describe('runDirectWork', () => {
	test('runs the repo’s gates before any agent, builds, verifies, and ends passed', async () => {
		const { run } = setupDirectRun();

		const result = await run();

		expect(result.ok).toBe(true);
		expect(result.manifest.status).toBe(RunStatus.Passed);
		expect(mockRunGates.mock.calls.map((call) => call[0].step)).toStrictEqual(['pre-flight', 'verify']);
	});

	test('records the ticket on the manifest and keeps its body beside the run, because that is the document the run was built from', async () => {
		const { cwd, run } = setupDirectRun();

		const result = await run();

		expect(result.manifest.ticketRef).toBe('LO-70');
		expect(result.manifest.pipeline).toBe('direct');
		expect(readFileSync(join(await resolveRunDir({ cwd, runId: result.manifest.runId }), 'ticket.md'), 'utf8')).toBe(
			'# Drain the backlog\n\nBuild the thing.\n',
		);
	});

	test('records the ship intent it was started with, so the progress view can draw a ship row for a direct run too', async () => {
		const { run } = setupDirectRun();

		expect((await run({ willShip: true })).manifest.willShip).toBe(true);
	});

	test('a direct run nobody asked to ship records no intent at all', async () => {
		const { run } = setupDirectRun();

		expect((await run()).manifest.willShip).toBeUndefined();
	});

	test('lists every step it will take from its first moment, with the steps it has not reached shown pending', async () => {
		const { cwd, run } = setupDirectRun();
		const runId = '20260924-step-order';
		const rowsAtStart: { id: string; status: RunStatus | undefined }[] = [];

		mockRunGates.mockImplementationOnce(async () => {
			const progress = await getRunProgress({ cwd, manifest: await readRunManifest({ cwd, runId }), live: false });

			rowsAtStart.push(...progress.rows.map(({ id, status }) => ({ id, status })));

			return { error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined };
		});

		const result = await run({ runId });

		// read while the pre-flight gate runs — the first step, before any agent
		expect(rowsAtStart).toStrictEqual([
			{ id: 'pre-flight', status: RunStatus.Running },
			{ id: 'implement', status: undefined },
			{ id: 'verify', status: undefined },
		]);
		expect(result.manifest.stepOrder).toStrictEqual(['pre-flight', 'implement', 'verify']);
	});

	test('writes a ticket body that already ends in a newline without adding a second one', async () => {
		const { cwd, run } = setupDirectRun();

		const result = await run({ ticketBody: '# Drain the backlog\n' });

		expect(readFileSync(join(await resolveRunDir({ cwd, runId: result.manifest.runId }), 'ticket.md'), 'utf8')).toBe('# Drain the backlog\n');
	});

	test('merges the agent’s changed files into the manifest, which is what the run reports afterwards', async () => {
		const { run } = setupDirectRun();

		expect((await run()).manifest.changedFiles).toStrictEqual(['src/thing.ts']);
	});

	test('parks rather than fails when the harness hit its rate limit, so the work is resumable', async () => {
		const { run } = setupDirectRun();

		mockInvokeAgentWithContract.mockResolvedValue({ ok: false, failure: 'harness rate limited or overloaded', rateLimited: true });

		expect((await run()).manifest.status).toBe(RunStatus.PausedRateLimit);
	});

	test('fails on a harness that refused for any other reason', async () => {
		const { run } = setupDirectRun();

		mockInvokeAgentWithContract.mockResolvedValue({ ok: false, failure: 'agent invocation failed: timed out', rateLimited: false });

		expect((await run()).manifest.status).toBe(RunStatus.Failed);
	});

	test('escalates an ambiguous ticket carrying the question, which is exactly what the queue’s relay reads', async () => {
		const { run } = setupDirectRun();

		mockInvokeAgentWithContract.mockResolvedValue({
			ok: true,
			report: reportOf({ status: WorkReportStatus.TerminatedAmbiguity, failures: ['Which one?'] }),
		});

		const result = await run();

		expect(result.manifest.status).toBe(RunStatus.Escalated);
		expect(result.error).toBe('Which one?');
	});

	test('fails a report that stopped for any other reason, rather than sending a question that is not one', async () => {
		const { run } = setupDirectRun();

		mockInvokeAgentWithContract.mockResolvedValue({
			ok: true,
			report: reportOf({ status: WorkReportStatus.TerminatedStaleReferences, failures: ['src/gone.ts does not exist'] }),
		});

		const result = await run();

		expect(result.manifest.status).toBe(RunStatus.Failed);
		expect(result.error).toBe('src/gone.ts does not exist');
	});

	test('falls back to the report’s summary when a stopped worker listed no failure, so the run never stops with an empty reason', async () => {
		const { run } = setupDirectRun();

		mockInvokeAgentWithContract.mockResolvedValue({
			ok: true,
			report: reportOf({ status: WorkReportStatus.TerminatedScope, failures: [], summary: 'the ticket asks for two features' }),
		});

		const result = await run();

		expect(result.manifest.status).toBe(RunStatus.Failed);
		expect(result.error).toBe('the ticket asks for two features');
	});

	test('folds a relayed answer into the worker’s first invocation, telling it to continue its own earlier attempt', async () => {
		const { run } = setupDirectRun();

		await run({ answeredQuestion: { question: 'Which one?', answer: 'the second one' } });

		expect(mockInvokeAgentWithContract.mock.calls[0]?.[0].invocation.prompt).toContain('the second one');
	});

	test('tells the direct worker its own self-check command, naming the run the agent is inside', async () => {
		const { run } = setupDirectRun();

		const result = await run();

		// the harness allowance only permits the command; the binding grant is the
		// prompt section, and the command it hands over names the live run, which is
		// the only parameter that command takes
		expect(mockInvokeAgentWithContract.mock.calls[0]?.[0].invocation.systemPrompt).toContain(
			`node ${process.argv[1]} self-check --run ${result.manifest.runId}`,
		);
	});

	test("grants the direct worker the engine self-check prefix alongside the consumer's own commands", async () => {
		const { run } = setupDirectRun({ agentCommands: ['pnpm --filter api run prisma:migrate:dev:name'] });

		await run();

		// The harness allowance is the consumer's own list plus the engine's
		// self-check prefix. `process.argv[1]` is the running CLI bundle, which is
		// what the subprocess must resolve, and the prefix stays unquoted because
		// the harness matches it literally.
		expect(mockInvokeAgentWithContract.mock.calls[0]?.[0].allowedCommands).toStrictEqual([
			'pnpm --filter api run prisma:migrate:dev:name',
			`node ${process.argv[1]} self-check`,
		]);
	});
});
