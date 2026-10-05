import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { getRunView } from '#src/views/getRunView/getRunView.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

/** A frozen refactor work-list that parses, so a reader ignoring it is a choice rather than a failure. */
const worklistNaming = ({ rules }: { rules: string[] }) =>
	JSON.stringify({
		at: '2026-01-01T00:00:00.000Z',
		path: '.',
		all: false,
		batches: rules.map((rule, index) => ({ id: `batch-0${index}:${rule}:src`, rule, folder: 'src', blocking: [], advisories: [] })),
	});

test("a coordinator's steps name the phase file each implemented and the child run that did it", async () => {
	const cwd = await freshCwd();

	await mkdir(join(cwd, 'plans', 'add-search'), { recursive: true });
	await writeFile(join(cwd, 'plans', 'add-search', 'phase1.md'), '# Phase 1\n', 'utf8');
	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-coordinator',
			pipeline: 'phases',
			plan: 'plans/add-search/overview.md',
			status: RunStatus.Running,
			currentStep: 'phase2.md',
			// Step ids are the phase FILE names, extension included — what
			// initializeSequence records for every real phased run.
			steps: [
				{ id: 'phase1.md', status: RunStatus.Passed, attempts: 1, report: { runId: 'run-child' } },
				{ id: 'phase2.md', status: RunStatus.Running, attempts: 1 },
			],
		},
	});
	await seedRunDir({ cwd, manifest: { runId: 'run-child', overview: 'plans/add-search/overview.md', plan: 'plans/add-search/phase1.md' } });

	const view = await getRunView({ cwd, runId: 'run-coordinator' });

	// a coordinator's manifest carries no `overview` field; its own plan IS the overview
	expect(view.overview).toBe('plans/add-search/overview.md');
	expect(view.currentStep).toBe('phase2.md');
	// a step whose phase file is on disk names it; one whose file is not stays silent
	expect(view.steps.map((step) => ({ id: step.id, planPath: step.planPath, childRunId: step.childRunId }))).toStrictEqual([
		{ id: 'phase1.md', planPath: 'plans/add-search/phase1.md', childRunId: 'run-child' },
		{ id: 'phase2.md', planPath: undefined, childRunId: undefined },
	]);
	// nothing spawned the coordinator
	expect(view.parent).toBe(undefined);
});

test('a coordinator that recorded an overview of its own is read by that, not by its plan path', async () => {
	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-recorded-overview',
			pipeline: 'phases',
			plan: 'plans/add-search/overview.md',
			overview: 'plans/moved/overview.md',
			steps: [{ id: 'phase1.md', status: RunStatus.Pending, attempts: 0 }],
		},
	});

	const view = await getRunView({ cwd, runId: 'run-recorded-overview' });

	// a recorded overview outranks the fallback, so a coordinator whose plan path
	// is not the overview still reports the document its phases were cut from
	expect(view.overview).toBe('plans/moved/overview.md');
});

test('a phase run names the coordinator its own manifest records, and the step it served', async () => {
	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-coordinator',
			pipeline: 'phases',
			plan: 'plans/add-search/overview.md',
			steps: [{ id: 'phase1', status: RunStatus.Passed, attempts: 1, report: { runId: 'run-child' } }],
		},
	});
	// a sequence that named some other run is never opened at all: the link is a
	// field on this run, not something reconstructed from the rest of the history
	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-other-sequence',
			pipeline: 'phases',
			plan: 'plans/other/overview.md',
			steps: [{ id: 'phase1', status: RunStatus.Passed, attempts: 1, report: { runId: 'run-child' } }],
		},
	});
	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-child',
			overview: 'plans/add-search/overview.md',
			plan: 'plans/add-search/phase1.md',
			parentRunId: 'run-coordinator',
		},
	});

	const view = await getRunView({ cwd, runId: 'run-child' });

	// a back-link a reader can follow, titled the way the runs table titles it
	expect(view.parent).toStrictEqual({ runId: 'run-coordinator', step: 'phase1', title: 'add-search' });
	// a child run records its overview outright
	expect(view.overview).toBe('plans/add-search/overview.md');
});

test('a phase still in flight is named by the step the coordinator has open, since no report names it yet', async () => {
	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-coordinator',
			pipeline: 'phases',
			plan: 'plans/add-search/overview.md',
			currentStep: 'phase2',
			steps: [{ id: 'phase2', status: RunStatus.Running, attempts: 1 }],
		},
	});
	await seedRunDir({ cwd, manifest: { runId: 'run-child', plan: 'plans/add-search/phase2.md', parentRunId: 'run-coordinator' } });

	expect((await getRunView({ cwd, runId: 'run-child' })).parent).toStrictEqual({
		runId: 'run-coordinator',
		step: 'phase2',
		title: 'add-search',
	});
});

test('a run recording no coordinator, and one whose coordinator will not read, both go without a back-link', async () => {
	const cwd = await freshCwd();

	await seedRunDir({ cwd, manifest: { runId: 'bbb-broken' } });
	await writeFile(join(runDirFor({ cwd, runId: 'bbb-broken' }), 'manifest.json'), '{ not json', 'utf8');
	await seedRunDir({ cwd, manifest: { runId: 'ccc-orphan' } });
	await seedRunDir({ cwd, manifest: { runId: 'ddd-dangling', parentRunId: 'bbb-broken' } });

	// a top-level run, and a phase child whose coordinator is corrupt or gone —
	// neither is a page failure, both are simply a run with no parent to name
	expect((await getRunView({ cwd, runId: 'ccc-orphan' })).parent).toBe(undefined);
	expect((await getRunView({ cwd, runId: 'ddd-dangling' })).parent).toBe(undefined);
});

test('a back-link is titled from the coordinator manifest alone, so a work-list plan reads as the pipeline that froze it', async () => {
	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-sequence',
			pipeline: 'phases',
			plan: '.lightsout/runs/run-sequence/worklist.json',
			steps: [{ id: 'phase1', status: RunStatus.Passed, attempts: 1, report: { runId: 'run-child' } }],
		},
		worklist: worklistNaming({ rules: ['multi-export', 'file-size'] }),
	});
	await seedRunDir({ cwd, manifest: { runId: 'run-child', parentRunId: 'run-sequence' } });

	const view = await getRunView({ cwd, runId: 'run-child' });

	// the back-link reads the coordinator's manifest only — the readable work-list
	// beside it is never opened, so the label is the plain pipeline name rather
	// than the rules that file names
	expect(view.parent).toStrictEqual({ runId: 'run-sequence', step: 'phase1', title: 'refactor' });
});

test('a coordinator that has not yet opened a step for this child leaves the back-link off rather than naming nothing', async () => {
	const cwd = await freshCwd();

	// a sequence that has recorded no report for this run and has no step open —
	// there is no honest step to name, so the link waits rather than guessing
	await seedRunDir({ cwd, manifest: { runId: 'run-sequence', pipeline: 'phases', plan: 'plans/add-search/overview.md' } });
	await seedRunDir({ cwd, manifest: { runId: 'run-child', plan: 'plans/add-search/phase1.md', parentRunId: 'run-sequence' } });

	expect((await getRunView({ cwd, runId: 'run-child' })).parent).toBe(undefined);
});

test("keeps a named phase child that has not started yet as the step's child", async () => {
	const cwd = await freshCwd();

	// the coordinator names its child on the running step before the child's own
	// manifest exists — that window is not yet started, never a page failure
	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-coordinator',
			pipeline: 'phases',
			plan: 'plans/add-search/overview.md',
			status: RunStatus.Running,
			currentStep: 'phase1.md',
			steps: [{ id: 'phase1.md', status: RunStatus.Running, attempts: 1, report: { runId: 'run-unstarted' } }],
		},
	});

	const view = await getRunView({ cwd, runId: 'run-coordinator' });

	expect(view.steps.map((step) => ({ id: step.id, status: step.status, childRunId: step.childRunId }))).toStrictEqual([
		{ id: 'phase1.md', status: RunStatus.Running, childRunId: 'run-unstarted' },
	]);
});

test('a coordinator step keeps naming a child that has not started yet', async () => {
	const cwd = await freshCwd();

	// phase one's child ran and left a manifest; phase two's child is named on the
	// running step before its own manifest exists, so the view must not read it
	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-sequence',
			pipeline: 'phases',
			plan: 'plans/add-search/overview.md',
			status: RunStatus.Running,
			currentStep: 'phase2.md',
			steps: [
				{ id: 'phase1.md', status: RunStatus.Passed, attempts: 1, report: { runId: 'run-phase-one' } },
				{ id: 'phase2.md', status: RunStatus.Running, attempts: 1, report: { runId: 'run-phase-two-unstarted' } },
			],
		},
	});
	await seedRunDir({ cwd, manifest: { runId: 'run-phase-one', plan: 'plans/add-search/phase1.md', parentRunId: 'run-sequence' } });

	const view = await getRunView({ cwd, runId: 'run-sequence' });

	expect(view.steps.map((step) => ({ id: step.id, childRunId: step.childRunId }))).toStrictEqual([
		{ id: 'phase1.md', childRunId: 'run-phase-one' },
		{ id: 'phase2.md', childRunId: 'run-phase-two-unstarted' },
	]);
});
