import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { loadRunFamilyProgressBlock } from '#src/cli/internal/common/progressBlock/loadRunFamilyProgressBlock.ts';
import { loadRunProgressBlock } from '#src/cli/internal/common/progressBlock/loadRunProgressBlock.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

/** The one clock the loader and the expected blocks both read, so a running row ticks to the same value in each. */
const pinnedNow = Date.parse('2026-09-10T10:30:00.000Z');

/** The coordinator a phase child names but whose own manifest is written unreadable. */
const corruptRootId = 'dddd9999-corrupt-root';

interface SeededRun {
	runId: string;
	plan: string;
	createdAt: string;
	updatedAt: string;
	status: RunManifest['status'];
	/** The coordinator that started this run, when it is a phase child. */
	parentRunId?: string;
}

/** A run belonging to no family: no coordinator above it and no phase children below it. */
const solo: SeededRun = {
	runId: 'ssss0000-solo-run',
	plan: 'plans/solo/plan.md',
	createdAt: '2026-09-10T10:00:00.000Z',
	updatedAt: '2026-09-10T10:12:00.000Z',
	status: RunStatus.Running,
};

/** The phased plan's coordinator — one step per phase, and no lock of its own. */
const coordinator: SeededRun = {
	runId: 'cccc0000-coordinator',
	plan: 'plans/phased/plan.md',
	createdAt: '2026-09-10T10:00:00.000Z',
	updatedAt: '2026-09-10T10:05:00.000Z',
	status: RunStatus.Running,
};

/** The earliest-created child, finished, and NOT the most recently updated one. */
const firstPhase: SeededRun = {
	runId: 'pppp1111-phase-one',
	plan: 'plans/phase-one/plan.md',
	createdAt: '2026-09-10T10:01:00.000Z',
	updatedAt: '2026-09-10T10:08:00.000Z',
	status: RunStatus.Passed,
	parentRunId: coordinator.runId,
};

/** The phase that is moving, updated BEFORE its finished sibling — so a pairing by update time alone picks the wrong one. */
const goingPhase: SeededRun = {
	runId: 'qqqq2222-phase-two',
	plan: 'plans/phase-two/plan.md',
	createdAt: '2026-09-10T10:02:00.000Z',
	updatedAt: '2026-09-10T10:10:00.000Z',
	status: RunStatus.Running,
	parentRunId: coordinator.runId,
};

/** The most recently updated child, finished, and created after `firstPhase`. */
const latestPhase: SeededRun = {
	runId: 'rrrr3333-phase-three',
	plan: 'plans/phase-three/plan.md',
	createdAt: '2026-09-10T10:03:00.000Z',
	updatedAt: '2026-09-10T10:20:00.000Z',
	status: RunStatus.Passed,
	parentRunId: coordinator.runId,
};

/** A running phase child whose coordinator is the unreadable one. */
const orphanPhase: SeededRun = {
	runId: 'oooo4444-orphan-phase',
	plan: 'plans/orphan-phase/plan.md',
	createdAt: '2026-09-10T10:04:00.000Z',
	updatedAt: '2026-09-10T10:18:00.000Z',
	status: RunStatus.Running,
	parentRunId: corruptRootId,
};

const manifestOf = ({ runId, plan, createdAt, updatedAt, status, parentRunId }: SeededRun): Partial<RunManifest> & { runId: string } => ({
	runId,
	plan,
	createdAt,
	updatedAt,
	status,
	parentRunId,
	currentStep: status === RunStatus.Running ? 'implement' : null,
	steps: [{ id: 'implement', status, attempts: 1, durationMs: 60_000 }],
	stepOrder: ['implement', 'test'],
});

/**
 * A checkout holding the given runs, plus each one's block as the real
 * `loadRunProgressBlock` draws it — the lines the family loader must hand back
 * untouched. `withCorruptRoot` adds a run directory whose manifest will not
 * parse, which `listRuns` skips in silence.
 */
const setupFamily = async ({ seeded, withCorruptRoot = false }: { seeded: SeededRun[]; withCorruptRoot?: boolean }) => {
	jest.spyOn(Date, 'now').mockReturnValue(pinnedNow);

	const cwd = await freshCwd();

	for (const run of seeded) {
		await seedRunDir({ cwd, manifest: manifestOf(run) });
	}

	if (withCorruptRoot) {
		const corruptDir = runDirFor({ cwd, runId: corruptRootId });

		await mkdir(corruptDir, { recursive: true });
		await writeFile(join(corruptDir, 'manifest.json'), '{ half-written', 'utf8');
	}

	const blocks: Record<string, string[]> = {};

	for (const run of seeded) {
		const { lines } = await loadRunProgressBlock({ cwd, runId: run.runId });

		blocks[run.runId] = lines;
	}

	return { cwd, blocks };
};

/** The phase child id a coordinator's running step names before that child's own manifest is written. */
const unstartedChildId = 'uuuu5555-unstarted-phase';

/**
 * A phased coordinator whose first phase is running and already names its
 * child on the step's `PhaseReport`, while no manifest answers to that child
 * yet — the window between the coordinator recording the id and the child's
 * run being created. Answers the coordinator's own block as the real
 * `loadRunProgressBlock` draws it.
 */
const setupUnstartedChild = async () => {
	jest.spyOn(Date, 'now').mockReturnValue(pinnedNow);

	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: {
			runId: coordinator.runId,
			pipeline: 'phases',
			plan: 'plans/phased/overview.md',
			createdAt: coordinator.createdAt,
			updatedAt: coordinator.updatedAt,
			status: RunStatus.Running,
			currentStep: 'phase1.md',
			steps: [
				{ id: 'phase1.md', status: RunStatus.Running, attempts: 1, report: { runId: unstartedChildId } },
				{ id: 'phase2.md', status: RunStatus.Pending, attempts: 0 },
			],
		},
	});

	const { lines: coordinatorBlock } = await loadRunProgressBlock({ cwd, runId: coordinator.runId });

	return { cwd, coordinatorBlock };
};

/** A running phase child the coordinator's running step can name, updated BEFORE `goingPhase` — so a choice by update time alone would pass it over. */
const namedPhase: SeededRun = {
	runId: 'nnnn6666-named-phase',
	plan: 'plans/named-phase/plan.md',
	createdAt: '2026-09-10T10:02:30.000Z',
	updatedAt: '2026-09-10T10:06:00.000Z',
	status: RunStatus.Running,
	parentRunId: coordinator.runId,
};

/**
 * The family as `setupFamily` seeds it, plus what the loader must answer for
 * it: the root's `RunProgress` as the real `loadRunProgressBlock` reads it, and
 * the root's block followed — after a blank line — by the shown child's block.
 */
const setupRootProgress = async ({
	seeded,
	withCorruptRoot,
	rootId,
	shownChildId,
}: {
	seeded: SeededRun[];
	withCorruptRoot: boolean;
	rootId: string;
	shownChildId: string | undefined;
}) => {
	const { cwd, blocks } = await setupFamily({ seeded, withCorruptRoot });
	const { progress } = await loadRunProgressBlock({ cwd, runId: rootId });
	const lines = shownChildId === undefined ? blocks[rootId] : [...blocks[rootId], '', ...blocks[shownChildId]];

	return { cwd, expected: { progress, lines } };
};

/**
 * A phased coordinator whose second phase is running, its first phase passed
 * and naming `firstPhase`, and whose running step names `runningChildId` on its
 * `PhaseReport` — or names no child when that is undefined. Answers each run's
 * block as the real `loadRunProgressBlock` draws it.
 */
const setupNamedChild = async ({ runningChildId, children }: { runningChildId: string | undefined; children: SeededRun[] }) => {
	jest.spyOn(Date, 'now').mockReturnValue(pinnedNow);

	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: {
			runId: coordinator.runId,
			pipeline: 'phases',
			plan: 'plans/phased/overview.md',
			createdAt: coordinator.createdAt,
			updatedAt: coordinator.updatedAt,
			status: RunStatus.Running,
			currentStep: 'phase2.md',
			steps: [
				{ id: 'phase1.md', status: RunStatus.Passed, attempts: 1, report: { runId: firstPhase.runId } },
				{
					id: 'phase2.md',
					status: RunStatus.Running,
					attempts: 1,
					...(runningChildId === undefined ? {} : { report: { runId: runningChildId } }),
				},
			],
		},
	});

	for (const child of children) {
		await seedRunDir({ cwd, manifest: manifestOf(child) });
	}

	const blocks: Record<string, string[]> = {};

	for (const runId of [coordinator.runId, ...children.map((child) => child.runId)]) {
		const { lines } = await loadRunProgressBlock({ cwd, runId });

		blocks[runId] = lines;
	}

	return { cwd, blocks };
};

describe('loadRunFamilyProgressBlock', () => {
	test('a run with no phase children answers its own block alone', async () => {
		const { cwd, blocks } = await setupFamily({ seeded: [solo] });

		const { lines } = await loadRunFamilyProgressBlock({ cwd, runId: solo.runId });

		expect(lines).toStrictEqual(blocks[solo.runId]);
	});

	test('climbs from a phase child to its coordinator, prefers the going phase, and separates the two blocks with a blank line', async () => {
		const { cwd, blocks } = await setupFamily({ seeded: [coordinator, goingPhase, latestPhase] });

		const { lines } = await loadRunFamilyProgressBlock({ cwd, runId: goingPhase.runId });

		expect(lines).toStrictEqual([...blocks[coordinator.runId], '', ...blocks[goingPhase.runId]]);
	});

	test('with no phase going the coordinator is paired with the most recently updated child', async () => {
		const { cwd, blocks } = await setupFamily({ seeded: [coordinator, firstPhase, latestPhase] });

		const { lines } = await loadRunFamilyProgressBlock({ cwd, runId: coordinator.runId });

		expect(lines).toStrictEqual([...blocks[coordinator.runId], '', ...blocks[latestPhase.runId]]);
	});

	test('a phase child whose coordinator cannot be read answers its own block alone', async () => {
		const { cwd, blocks } = await setupFamily({ seeded: [orphanPhase], withCorruptRoot: true });

		const { lines } = await loadRunFamilyProgressBlock({ cwd, runId: orphanPhase.runId });

		expect(lines).toStrictEqual(blocks[orphanPhase.runId]);
	});

	test('a run id with no manifest on disk rejects with RunNotFoundError', async () => {
		const { cwd } = await setupFamily({ seeded: [solo] });

		await expect(loadRunFamilyProgressBlock({ cwd, runId: 'ghost-run-id' })).rejects.toThrow(RunNotFoundError);
	});

	test('shows the coordinator alone while its named first child has not started', async () => {
		const { cwd, coordinatorBlock } = await setupUnstartedChild();

		const { lines } = await loadRunFamilyProgressBlock({ cwd, runId: coordinator.runId });

		expect(lines).toStrictEqual(coordinatorBlock);
	});

	test.each([
		{
			seeded: [coordinator, goingPhase, latestPhase],
			withCorruptRoot: false,
			runId: goingPhase.runId,
			rootId: coordinator.runId,
			shownChildId: goingPhase.runId,
		},
		{
			seeded: [orphanPhase],
			withCorruptRoot: true,
			runId: orphanPhase.runId,
			rootId: orphanPhase.runId,
			shownChildId: undefined,
		},
	])("answers the family root's progress alongside the screen lines", async ({ seeded, withCorruptRoot, runId, rootId, shownChildId }) => {
		const { cwd, expected } = await setupRootProgress({ seeded, withCorruptRoot, rootId, shownChildId });

		const screen = await loadRunFamilyProgressBlock({ cwd, runId });

		expect(screen).toStrictEqual(expected);
	});

	test.each([
		{ runningChildId: namedPhase.runId, children: [firstPhase, namedPhase, goingPhase], shownChildId: namedPhase.runId },
		{ runningChildId: unstartedChildId, children: [firstPhase, goingPhase], shownChildId: undefined },
		{ runningChildId: undefined, children: [namedPhase, goingPhase, latestPhase], shownChildId: goingPhase.runId },
	])(
		"shows the child the root's running step names, and the coordinator alone while that child has not started",
		async ({ runningChildId, children, shownChildId }) => {
			const { cwd, blocks } = await setupNamedChild({ runningChildId, children });

			const { lines } = await loadRunFamilyProgressBlock({ cwd, runId: coordinator.runId });

			expect(lines).toStrictEqual(shownChildId === undefined ? blocks[coordinator.runId] : [...blocks[coordinator.runId], '', ...blocks[shownChildId]]);
		},
	);
});
