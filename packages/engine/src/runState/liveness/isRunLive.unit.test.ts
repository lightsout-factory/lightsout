import { expect, test } from '@jest/globals';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { isRunLive } from '#src/runState/liveness/isRunLive.ts';

const manifest = (overrides: Partial<RunManifest> = {}): RunManifest => ({
	runId: 'run-parent',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:01:00.000Z',
	plan: 'plans/demo/overview.md',
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

test('nothing stands behind the run, so it is not live', () => {
	expect(isRunLive({ manifest: manifest(), root: undefined, ownerAlive: undefined, liveLockRunId: undefined })).toBe(false);
});

test('an owner whose process is gone is a crash leftover, not a live run', () => {
	expect(isRunLive({ manifest: manifest(), root: undefined, ownerAlive: false, liveLockRunId: undefined })).toBe(false);
});

test('a live lock naming this run is the simple case', () => {
	expect(isRunLive({ manifest: manifest(), root: undefined, ownerAlive: undefined, liveLockRunId: 'run-parent' })).toBe(true);
});

test('a non-phased run never borrows another run id, however its steps are reported', () => {
	const implement = manifest({ steps: [{ id: 'implement', status: RunStatus.Running, attempts: 1, report: { runId: 'run-child' } }] });

	expect(isRunLive({ manifest: implement, root: undefined, ownerAlive: undefined, liveLockRunId: 'run-child' })).toBe(false);
});

const phasedRoot = (overrides: Partial<RunManifest> = {}): RunManifest =>
	manifest({
		pipeline: 'phases',
		steps: [{ id: 'phase1', status: RunStatus.Running, attempts: 1, report: { runId: 'run-child' } }],
		...overrides,
	});

const phaseChild = (): RunManifest => manifest({ runId: 'run-child', parentRunId: 'run-parent' });

test('a root run follows its owner record and never the lock once the root has recorded an owner', () => {
	const root = manifest();

	const ownerLives = isRunLive({ manifest: root, root: undefined, ownerAlive: true, liveLockRunId: undefined });
	const ownerGoneLockHeld = isRunLive({ manifest: root, root: undefined, ownerAlive: false, liveLockRunId: 'run-parent' });

	expect({ ownerLives, ownerGoneLockHeld }).toStrictEqual({ ownerLives: true, ownerGoneLockHeld: false });
});

test('a run that is neither running nor pending is never live whatever stands behind it', () => {
	const settled = [RunStatus.Passed, RunStatus.Failed, RunStatus.Escalated, RunStatus.PausedRateLimit, RunStatus.PausedBudget];

	const answers = settled.map((status) => isRunLive({ manifest: manifest({ status }), root: undefined, ownerAlive: true, liveLockRunId: 'run-parent' }));

	expect(answers).toStrictEqual([false, false, false, false, false]);
});

test("a phase child is live only while its root's owner lives and the root's running step names it", () => {
	const child = phaseChild();
	const namedByAnother = phasedRoot({
		steps: [
			{ id: 'phase1', status: RunStatus.Passed, attempts: 1, report: { runId: 'run-child' } },
			{ id: 'phase2', status: RunStatus.Running, attempts: 1, report: { runId: 'run-sibling' } },
		],
	});

	const moving = isRunLive({ manifest: child, root: phasedRoot(), ownerAlive: true, liveLockRunId: undefined });
	const ownerGone = isRunLive({ manifest: child, root: phasedRoot(), ownerAlive: false, liveLockRunId: undefined });
	const anotherChildMoving = isRunLive({ manifest: child, root: namedByAnother, ownerAlive: true, liveLockRunId: undefined });
	const rootNotRunning = isRunLive({
		manifest: child,
		root: phasedRoot({ status: RunStatus.Failed }),
		ownerAlive: true,
		liveLockRunId: undefined,
	});
	const rootUnreadable = isRunLive({ manifest: child, root: undefined, ownerAlive: true, liveLockRunId: undefined });

	expect({ moving, ownerGone, anotherChildMoving, rootNotRunning, rootUnreadable }).toStrictEqual({
		moving: true,
		ownerGone: false,
		anotherChildMoving: false,
		rootNotRunning: false,
		rootUnreadable: false,
	});
});

test("a run with no owner record falls back to its own lock and no longer borrows a child's", () => {
	const root = manifest();

	const ownLock = isRunLive({ manifest: root, root: undefined, ownerAlive: undefined, liveLockRunId: 'run-parent' });
	const strangerLock = isRunLive({ manifest: root, root: undefined, ownerAlive: undefined, liveLockRunId: 'run-stranger' });
	const noLock = isRunLive({ manifest: root, root: undefined, ownerAlive: undefined, liveLockRunId: undefined });
	const coordinatorUnderChildLock = isRunLive({
		manifest: phasedRoot(),
		root: undefined,
		ownerAlive: undefined,
		liveLockRunId: 'run-child',
	});

	expect({ ownLock, strangerLock, noLock, coordinatorUnderChildLock }).toStrictEqual({
		ownLock: true,
		strangerLock: false,
		noLock: false,
		coordinatorUnderChildLock: false,
	});
});
