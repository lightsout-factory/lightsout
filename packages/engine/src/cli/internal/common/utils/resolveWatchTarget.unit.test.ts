import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { resolveWatchTarget } from '#src/cli/internal/common/utils/resolveWatchTarget.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { getRunOwnerPath } from '#src/runState/owner/getRunOwnerPath.ts';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

/** Beyond any OS pid range — the live-process probe reports it dead. */
const deadPid = 999_999_999;

type WatchTarget = Awaited<ReturnType<typeof resolveWatchTarget>>;

const manifestOf = ({ runId, ...overrides }: { runId: string } & Partial<RunManifest>): RunManifest => ({
	runId,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
	plan: 'plans/demo/plan.md',
	harness: 'claude-code',
	status: RunStatus.Running,
	currentStep: null,
	steps: [],
	changedFiles: [],
	commits: [],
	packages: [],
	baselineDirtyFiles: [],
	testSubjects: [],
	acceptanceTests: [],
	approvedTests: [],
	unreachableChangedFiles: [],
	coverageExcludedChangedFiles: [],
	...overrides,
});

/**
 * The answer with any ambiguous ids in a fixed order, so the assertion states
 * which runs were named without turning on the order they were listed in.
 */
const withSortedIds = ({ target }: { target: WatchTarget }): WatchTarget =>
	target !== undefined && 'ambiguous' in target ? { ambiguous: [...target.ambiguous].sort() } : target;

/** A repo whose runs directory holds exactly the given manifests. */
const setupRuns = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-watch-target-'));

	mkdirSync(join(cwd, '.lightsout', 'runs'), { recursive: true });

	const plant = ({ runId, ...overrides }: { runId: string } & Partial<RunManifest>) => {
		mkdirSync(runDirFor({ cwd, runId }), { recursive: true });
		writeFileSync(join(runDirFor({ cwd, runId }), 'manifest.json'), JSON.stringify(manifestOf({ runId, ...overrides })), 'utf8');
	};

	/** One checkout's run lock — the file a run's live process is recognised by. */
	const lock = ({ checkout = cwd, runId, pid }: { checkout?: string; runId: string; pid: number }) => {
		mkdirSync(join(checkout, '.lightsout'), { recursive: true });
		writeFileSync(join(checkout, '.lightsout', 'lock.json'), JSON.stringify({ pid, runId, startedAt: '2026-01-01T00:00:00.000Z' }), 'utf8');
	};

	/** A separate checkout an isolated run works in, and takes its own lock in. */
	const workspace = ({ name }: { name: string }) => {
		const path = join(cwd, `workspace-${name}`);

		mkdirSync(path, { recursive: true });

		return path;
	};

	return { cwd, plant, lock, workspace };
};

/** An owner record naming a process that is gone — the record a crashed engine leaves behind. */
const plantDeadOwner = async ({ cwd, runId }: { cwd: string; runId: string }) => {
	writeFileSync(await getRunOwnerPath({ cwd, runId }), JSON.stringify({ pid: deadPid, recordedAt: '2026-01-01T00:00:00.000Z' }), 'utf8');
};

describe('resolveWatchTarget', () => {
	test('the sole run that is going is answered at once, without spending any of the grace', async () => {
		const { cwd, plant, lock } = setupRuns();

		plant({ runId: 'run-going', status: RunStatus.Running, updatedAt: '2026-01-01T00:00:01.000Z' });
		plant({ runId: 'run-done', status: RunStatus.Passed, updatedAt: '2026-01-01T00:05:00.000Z' });
		lock({ runId: 'run-going', pid: process.pid });

		const started = Date.now();
		const target = await resolveWatchTarget({ cwd, graceMs: 5_000, pollMs: 50 });

		expect(target).toEqual({ runId: 'run-going', rootRunId: 'run-going' });
		expect(Date.now() - started).toBeLessThan(2_000);
	});

	test('two unrelated runs going at once are ambiguous, both ids named, and neither is picked', async () => {
		const { cwd, plant, lock, workspace } = setupRuns();
		const first = workspace({ name: 'first' });
		const second = workspace({ name: 'second' });

		plant({ runId: 'run-first', status: RunStatus.Running, updatedAt: '2026-01-01T00:00:01.000Z', workspace: first });
		plant({ runId: 'run-second', status: RunStatus.Running, updatedAt: '2026-01-01T00:05:00.000Z', workspace: second });
		lock({ checkout: first, runId: 'run-first', pid: process.pid });
		lock({ checkout: second, runId: 'run-second', pid: process.pid });

		const target = await resolveWatchTarget({ cwd, graceMs: 200, pollMs: 20 });

		expect(withSortedIds({ target })).toEqual({ ambiguous: ['run-first', 'run-second'] });
	});

	test('a crash leftover beside a live run is passed over rather than making the choice ambiguous', async () => {
		const { cwd, plant, lock } = setupRuns();

		plant({ runId: 'run-leftover', status: RunStatus.Running, updatedAt: '2026-01-01T00:05:00.000Z' });
		plant({ runId: 'run-live', status: RunStatus.Running, updatedAt: '2026-01-01T00:00:01.000Z' });
		lock({ runId: 'run-live', pid: process.pid });

		const target = await resolveWatchTarget({ cwd, graceMs: 200, pollMs: 20 });

		expect(target).toEqual({ runId: 'run-live', rootRunId: 'run-live' });
	});

	test('a coordinator and its own phase child are one family, so a phased run is still followed rather than refused', async () => {
		const { cwd, plant, lock } = setupRuns();

		plant({ runId: 'run-coordinator', status: RunStatus.Running, updatedAt: '2026-01-01T00:00:01.000Z', pipeline: PipelineKind.Phases });
		plant({ runId: 'run-phase-two', status: RunStatus.Running, updatedAt: '2026-01-01T00:05:00.000Z', parentRunId: 'run-coordinator' });
		lock({ runId: 'run-phase-two', pid: process.pid });

		const target = await resolveWatchTarget({ cwd, graceMs: 200, pollMs: 20 });

		expect(target).toEqual({ runId: 'run-phase-two', rootRunId: 'run-coordinator' });
	});

	test('nothing going answers undefined once the grace period passes', async () => {
		const { cwd, plant } = setupRuns();

		plant({ runId: 'run-done', status: RunStatus.Passed, updatedAt: '2026-01-01T00:05:00.000Z' });

		const target = await resolveWatchTarget({ cwd, graceMs: 150, pollMs: 20 });

		expect(target).toBeUndefined();
	});

	test('a repo with no runs at all answers undefined rather than throwing', async () => {
		const { cwd } = setupRuns();

		const target = await resolveWatchTarget({ cwd, graceMs: 150, pollMs: 20 });

		expect(target).toBeUndefined();
	});

	test('a run that appears mid-wait is picked up — the race the implement skill would otherwise lose', async () => {
		const { cwd, plant, lock } = setupRuns();

		setTimeout(() => {
			plant({ runId: 'run-late', status: RunStatus.Running, updatedAt: '2026-01-01T00:05:00.000Z' });
			lock({ runId: 'run-late', pid: process.pid });
		}, 60);

		const target = await resolveWatchTarget({ cwd, graceMs: 5_000, pollMs: 20 });

		expect(target).toEqual({ runId: 'run-late', rootRunId: 'run-late' });
	});

	test('a run with no live process is never the going run, alone or beside a live one', async () => {
		const alone = setupRuns();
		const beside = setupRuns();

		alone.plant({ runId: 'run-stopped', status: RunStatus.Running, updatedAt: '2026-01-01T00:05:00.000Z' });
		await plantDeadOwner({ cwd: alone.cwd, runId: 'run-stopped' });
		beside.plant({ runId: 'run-stopped', status: RunStatus.Running, updatedAt: '2026-01-01T00:05:00.000Z' });
		await plantDeadOwner({ cwd: beside.cwd, runId: 'run-stopped' });
		beside.plant({ runId: 'run-live', status: RunStatus.Running, updatedAt: '2026-01-01T00:00:01.000Z' });
		await writeRunOwner({ cwd: beside.cwd, runId: 'run-live' });

		const stoppedAlone = await resolveWatchTarget({ cwd: alone.cwd, graceMs: 200, pollMs: 20 });
		const besideLive = await resolveWatchTarget({ cwd: beside.cwd, graceMs: 200, pollMs: 20 });

		expect({ stoppedAlone, besideLive }).toStrictEqual({ stoppedAlone: undefined, besideLive: { runId: 'run-live', rootRunId: 'run-live' } });
	});
});
