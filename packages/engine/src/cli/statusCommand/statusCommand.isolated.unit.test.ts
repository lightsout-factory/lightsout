import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { statusCommand } from '#src/cli/statusCommand/statusCommand.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { setupStatusRuns } from '#tests/helpers/setupStatusRuns.ts';
import { singlePlanManifestOf } from '#tests/helpers/singlePlanManifestOf.ts';

// Mocked Imports
// -------------------------
// `watchRunProgress` owns a two-minute repaint clock this command never sets and
// its own test drives directly; what belongs here is whether the command reaches
// for it, and with which family. Everything else — the manifests, the locks, the
// target resolution, the rendering — is real.
const mockWatchRunProgress = jest.fn<(params: { cwd: string; runId?: string; rootRunId?: string }) => Promise<void>>();

jest.mock('#src/cli/statusCommand/watchRunProgress.ts', () => ({
	watchRunProgress: (params: { cwd: string; runId?: string; rootRunId?: string }) => mockWatchRunProgress(params),
}));
// -------------------------

const stepOf = (overrides: Partial<StepRecord> = {}): StepRecord => ({
	id: 'phase1.md',
	status: RunStatus.Passed,
	attempts: 1,
	...overrides,
});

/**
 * A checkout of its own holding a live lock naming one run — where an isolated
 * run's process actually takes the per-checkout lock, while the run's records
 * stay in the checkout the command was launched from.
 */
const workspaceHoldingLock = ({ runId }: { runId: string }) => {
	const workspace = mkdtempSync(join(tmpdir(), 'lightsout-status-workspace-'));

	mkdirSync(join(workspace, '.lightsout'), { recursive: true });
	writeFileSync(join(workspace, '.lightsout', 'lock.json'), JSON.stringify({ pid: process.pid, runId, startedAt: '2026-01-01T00:00:01.000Z' }));

	return workspace;
};

/** Running isolated runs, one workspace each, in a launching checkout that holds no lock of its own. */
const setupIsolatedRuns = ({ runIds, args = {} }: { runIds: string[]; args?: Record<string, string | true> }) => {
	mockWatchRunProgress.mockResolvedValue(undefined);

	const manifests = runIds.map((runId) => singlePlanManifestOf({ runId, status: RunStatus.Running, workspace: workspaceHoldingLock({ runId }) }));
	const { context, ...captured } = setupStatusRuns({ manifests });

	return { context: { ...context, flags: new Map<string, string | true>(Object.entries(args)) }, ...captured };
};

/** Three hours, which is how long ago the run below last wrote its manifest. */
const threeHoursMs = 10_800_000;

/**
 * One `running` run opened with `--run`, its records three hours cold, either
 * holding its lock in a recorded workspace or nowhere at all. The block's clock
 * is what a live run and a stopped one differ by: the running step of a live run
 * shows its persisted total plus the time since that last write, and a run with
 * no process behind it shows the persisted number unchanged.
 */
const setupIsolatedProgress = ({ isolated }: { isolated: boolean }) => {
	const runId = 'run-iso';
	const lastWrite = new Date(Date.now() - threeHoursMs).toISOString();
	const manifest = singlePlanManifestOf({
		runId,
		createdAt: lastWrite,
		updatedAt: lastWrite,
		status: RunStatus.Running,
		currentStep: 'implement',
		steps: [stepOf({ id: 'implement', status: RunStatus.Running })],
		...(isolated ? { workspace: workspaceHoldingLock({ runId }) } : {}),
	});
	const { context, ...captured } = setupStatusRuns({ manifests: [manifest] });

	return { context: { ...context, flags: new Map<string, string | true>([['run', runId]]) }, ...captured };
};

describe('statusCommand', () => {
	test('a healthy isolated run is listed as running rather than as a crash leftover', async () => {
		const { context, logged, errors, exitCodes } = setupIsolatedRuns({ runIds: ['run-iso'] });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toStrictEqual(['run-iso  running  plan: plans/demo.md  updated: 2026-01-01T00:00:03.000Z']);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('an isolated run opened with --run has a block whose clock ticks, because its holder is found in the workspace it recorded', async () => {
		const { context, logged, errors, exitCodes } = setupIsolatedProgress({ isolated: true });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged.some((line) => line.startsWith(' elapsed 180m'))).toBe(true);
		expect(logged.some((line) => /^ ▶ {2}implement +running +180m/.test(line))).toBe(true);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('the same run with no recorded workspace and no holder anywhere has a block frozen at the time it last wrote', async () => {
		const { context, logged, exitCodes } = setupIsolatedProgress({ isolated: false });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toContain(' elapsed 0m 00s · 0 files');
		expect(logged.some((line) => /^ ■ {2}implement +stopped +0m 00s/.test(line))).toBe(true);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('a bare --watch with several runs going names the ids and exits 1 without painting a block', async () => {
		const { context, logged, errors, exitCodes } = setupIsolatedRuns({ runIds: ['run-alpha', 'run-beta'], args: { watch: true } });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors.join('\n')).toMatch(/run-alpha[\s\S]*run-beta|run-beta[\s\S]*run-alpha/);
		expect(errors.join('\n')).toMatch(/--run/);
		expect(logged).toStrictEqual([]);
		expect(mockWatchRunProgress).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([1]);
	});

	test('a bare --watch with one run going follows it rather than asking which', async () => {
		const { context, errors, exitCodes } = setupIsolatedRuns({ runIds: ['run-solo'], args: { watch: true } });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockWatchRunProgress).toHaveBeenCalledWith({ cwd: context.cwd, runId: 'run-solo' });
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});
});
