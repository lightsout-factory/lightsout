import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { lintPlanStructure } from '#src/plan/lint/lintPlanStructure.ts';
import { emptyDecisionsRecord } from '#tests/helpers/emptyDecisionsRecord.ts';
import { phaseBody } from '#tests/helpers/phasePlan.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

/**
 * Committed files with no export, so the consumer repo plants no consumer
 * beside them and each folder tracks exactly the files a test names.
 */
const trackedFiles = ({ paths }: { paths: string[] }) => Object.fromEntries(paths.map((path) => [path, '// tracked\n']));

/** The gate commands every consumer repo carries, with the executor-file-limit a case sets. */
const configWithLimit = ({ limit }: { limit: number }) =>
	LightsoutConfig.parse({ gates: { check: 'true', test: 'true', 'test-coverage': false }, 'executor-file-limit': limit });

/** One work order's plan folder holding the given files; returns their absolute paths in written order. */
const writeDeliverable = ({ cwd, workOrder, files }: { cwd: string; workOrder: string; files: Record<string, string> }) => {
	const dir = join(cwd, '.lightsout', 'work-orders', workOrder, 'plans');

	mkdirSync(dir, { recursive: true });

	return Object.entries(files).map(([name, body]) => {
		const path = join(dir, name);

		writeFileSync(path, body);

		return path;
	});
};

/** A committed consumer repo tracking `tracked`, and one plan folder per named deliverable. */
const setupDeliverables = ({ tracked, deliverables }: { tracked: string[]; deliverables: Record<string, Record<string, string>> }) => {
	const cwd = setupConsumerRepo({ sources: trackedFiles({ paths: tracked }) });
	const planPaths = Object.entries(deliverables).map(([workOrder, files]) => writeDeliverable({ cwd, workOrder, files }));

	return { cwd, planPaths };
};

/** Each deliverable linted on its own, in the order the deliverables were written. */
const lintEach = ({ cwd, planPaths }: { cwd: string; planPaths: string[][] }) =>
	Promise.all(planPaths.map((paths) => lintPlanStructure({ cwd, planPaths: paths, decisions: emptyDecisionsRecord() })));

/** The same plan files linted once per executor-file-limit, in the order the limits are given. */
const lintAtLimits = ({ cwd, planPaths, limits }: { cwd: string; planPaths: string[]; limits: number[] }) =>
	Promise.all(limits.map((limit) => lintPlanStructure({ cwd, planPaths, decisions: emptyDecisionsRecord(), config: configWithLimit({ limit }) })));

const checkOf = ({ findings, check }: { findings: StructuralFinding[]; check: StructuralCheck }) => findings.filter((finding) => finding.check === check);

/** The fields a placement assertion pins, leaving the issue and fix copy free. */
const placement = ({ findings }: { findings: StructuralFinding[] }) =>
	findings.map(({ check, severity, phase, location }) => ({ check, severity, phase, location }));

describe('lintPlanStructure', () => {
	test("lintPlanStructure: an ordinary phase's folder move counts each carried file on both sides against the file budget", async () => {
		const { cwd, planPaths } = setupDeliverables({
			tracked: ['src/old/a.ts', 'src/old/b.ts'],
			deliverables: { demo: { 'plan.md': phaseBody({ move: [{ from: 'src/old/', to: 'src/new/' }], reference: false }) } },
		});
		const [paths = []] = planPaths;

		const [atThree = [], atFour = []] = await lintAtLimits({ cwd, planPaths: paths, limits: [3, 4] });

		// two carried files touch four paths — old and new for each — so a limit of
		// three is exceeded and a limit of four is not, got: ${JSON.stringify(atThree)}
		expect({
			atThree: checkOf({ findings: atThree, check: StructuralCheck.ScopeWithinGuardrail }).map(({ severity, phase, issue }) => ({ severity, phase, issue })),
			atFour: checkOf({ findings: atFour, check: StructuralCheck.ScopeWithinGuardrail }),
		}).toEqual({
			atThree: [{ severity: FindingSeverity.Advisory, phase: 'plan.md', issue: expect.stringMatching(/touches 4 source files, over the 3-file limit/) }],
			atFour: [],
		});
	});

	test('lintPlanStructure: a move-folders-and-files phase moving a folder past the touched ceiling passes, and the same move in a standard phase is blocked', async () => {
		const move = [{ from: 'src/legacy/', to: 'src/modern/' }];
		const { cwd, planPaths } = setupDeliverables({
			tracked: Array.from({ length: 40 }, (_, index) => `src/legacy/mod${index}.ts`),
			deliverables: {
				moving: { 'move.md': phaseBody({ move, buildMode: 'move-folders-and-files', reference: false }) },
				standard: { 'standard.md': phaseBody({ move, reference: false }) },
			},
		});

		const [moving = [], standard = []] = await lintEach({ cwd, planPaths });

		// forty carried files touch eighty paths: the move mode is exempt from the
		// 70-file ceiling, while a standard phase counts them and is blocked, got:
		// ${JSON.stringify(moving)}
		expect({ moving, standard: checkOf({ findings: standard, check: StructuralCheck.TouchedFilesWithinCeiling }) }).toEqual({
			moving: [],
			standard: [
				expect.objectContaining({
					severity: FindingSeverity.Blocking,
					phase: 'standard.md',
					issue: expect.stringMatching(/touches 80 source files, over the 70-file ceiling/),
				}),
			],
		});
	});

	test('lintPlanStructure: a later phase names a file an earlier folder move carried by its new path under Files to Modify from Earlier Phases', async () => {
		const moveBody = phaseBody({ move: [{ from: 'src/old/', to: 'src/new/' }] });
		const { cwd, planPaths } = setupDeliverables({
			tracked: ['src/old/a.ts', 'src/old/b.ts'],
			deliverables: {
				earlier: { 'phase1-move.md': moveBody, 'phase2-edit.md': phaseBody({ earlierModify: ['src/new/a.ts'] }) },
				today: { 'phase1-move.md': moveBody, 'phase2-edit.md': phaseBody({ modify: ['src/new/a.ts'] }) },
			},
		});

		const [earlier = [], today = []] = await lintEach({ cwd, planPaths });

		// the carried file is absent from disk today and provided by phase 1, so
		// only the earlier-phase heading is right for it, got: ${JSON.stringify({ earlier, today })}
		expect({ earlier, today }).toEqual({
			earlier: [],
			today: [
				{
					check: StructuralCheck.FileProvenance,
					severity: FindingSeverity.Blocking,
					phase: 'phase2-edit.md',
					issue: expect.any(String),
					location: 'phase2-edit.md → src/new/a.ts',
					fix: expect.stringContaining('Files to Modify from Earlier Phases'),
				},
			],
		});
	});

	test('lintPlanStructure: a folder move that fails a folder-level check is reported once under move-well-formed and never as per-file path findings', async () => {
		const { cwd, planPaths } = setupDeliverables({
			tracked: ['src/old/a.ts', 'src/old/b.ts', 'src/new/c.ts'],
			deliverables: { demo: { 'plan.md': phaseBody({ move: [{ from: 'src/old/', to: 'src/new/' }], reference: false }) } },
		});

		const [findings = []] = await lintEach({ cwd, planPaths });

		// the destination already holds a tracked file: one finding at the heading,
		// and nothing about any file the move would have carried
		expect(placement({ findings })).toStrictEqual([
			{ check: StructuralCheck.MoveWellFormed, severity: FindingSeverity.Blocking, phase: 'plan.md', location: 'plan.md → src/old/' },
		]);
	});

	test('lintPlanStructure: a later phase relying on a defective earlier move gets no finding of its own, so the heading finding is the one edit to make', async () => {
		const { cwd, planPaths } = setupDeliverables({
			tracked: ['src/old/a.ts', 'src/new/c.ts', 'src/a/x.ts', 'src/b/y.ts'],
			deliverables: {
				existing: {
					'phase1-move.md': phaseBody({ move: [{ from: 'src/old/', to: 'src/new/' }] }),
					'phase2-edit.md': phaseBody({ earlierModify: ['src/new/a.ts'] }),
				},
				chained: {
					'phase1-move.md': phaseBody({
						move: [
							{ from: 'src/a/', to: 'src/b/' },
							{ from: 'src/b/', to: 'src/c/' },
						],
					}),
					'phase2-edit.md': phaseBody({ earlierModify: ['src/b/x.ts'] }),
				},
			},
		});

		const [existing = [], chained = []] = await lintEach({ cwd, planPaths });

		// provenance reads the defective move as written, so phase 2 is not blamed
		// for phase 1's defect, got: ${JSON.stringify({ existing, chained })}
		expect({ existing: placement({ findings: existing }), chained: placement({ findings: chained }) }).toStrictEqual({
			existing: [{ check: StructuralCheck.MoveWellFormed, severity: FindingSeverity.Blocking, phase: 'phase1-move.md', location: 'phase1-move.md → src/old/' }],
			chained: [
				{
					check: StructuralCheck.MoveWellFormed,
					severity: FindingSeverity.Blocking,
					phase: 'phase1-move.md',
					location: 'phase1-move.md → Files to Move',
				},
			],
		});
	});

	test('lintPlanStructure: a mixed move heading and a chained pair are each one move-well-formed finding, and a clean folder move raises neither', async () => {
		const body = phaseBody({
			move: [
				{ from: 'src/x.ts', to: 'src/y/' },
				{ from: 'src/p.ts', to: 'src/q.ts' },
				{ from: 'src/q.ts', to: 'src/r.ts' },
				{ from: 'src/clean/', to: 'src/tidy/' },
			],
			reference: false,
		});
		const mixedLine = body.split('\n').findIndex((line) => line.includes('`src/y/`')) + 1;
		const { cwd, planPaths } = setupDeliverables({
			tracked: ['src/x.ts', 'src/p.ts', 'src/q.ts', 'src/clean/k.ts'],
			deliverables: { demo: { 'plan.md': body } },
		});

		const [findings = []] = await lintEach({ cwd, planPaths });

		// read on the expanded plan, the clean folder move would overlap its own
		// carried file — the overlap check must see the plan as written, got:
		// ${JSON.stringify(findings)}
		expect(placement({ findings: checkOf({ findings, check: StructuralCheck.MoveWellFormed }) })).toStrictEqual([
			{ check: StructuralCheck.MoveWellFormed, severity: FindingSeverity.Blocking, phase: 'plan.md', location: 'plan.md → Files to Move' },
			{ check: StructuralCheck.MoveWellFormed, severity: FindingSeverity.Blocking, phase: 'plan.md', location: `plan.md:${mixedLine}` },
		]);
	});
});
