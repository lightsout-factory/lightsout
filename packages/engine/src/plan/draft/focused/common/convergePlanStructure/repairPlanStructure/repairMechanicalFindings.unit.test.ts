import { mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { DecisionRow } from '#src/contracts/plan/decisions/DecisionRow.ts';
import { DecisionSource } from '#src/contracts/plan/decisions/DecisionSource.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { repairMechanicalFindings } from '#src/plan/draft/focused/common/convergePlanStructure/repairPlanStructure/repairMechanicalFindings.ts';
import { lintPlanStructure } from '#src/plan/lint/lintPlanStructure/lintPlanStructure.ts';
import { parsePlan } from '#src/plan/parsePlan/parsePlan.ts';
import { engineOwnedReported } from '#tests/helpers/engineOwnedReported.ts';
import { overviewBody, phaseBody } from '#tests/helpers/phasePlan.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { setupPhasedDeliverable } from '#tests/helpers/setupPhasedDeliverable.ts';

// The deterministic pass: everything the engine owns — the Decision Log, the
// Global Constraints, the stamped phase counts and the paired phase row and
// declaration block — regenerated in code before a repair round lints, so an
// agent attempt is never spent on bookkeeping. Every other finding is left
// exactly as it was for the agent round that follows.

/** One merged decision row; only the two fields a criterion turns on are parameters. */
const decisionRow = ({ question, choice }: { question: string; choice: string }): DecisionRow => ({
	source: DecisionSource.Elicitation,
	question,
	options: 'this way / that way',
	choice,
	rationale: 'the cheaper of the two, and reversible',
	assumption: false,
});

/** The constraint choice the composed section has to carry, and the ordinary choice it must leave out. */
const constraintChoice = 'Every write goes through the store';
const ordinaryChoice = 'The engine renders the phase table from the phase record';

/** A record holding one plan-wide constraint and one ordinary decision, so a section composed from neither is visible. */
const settledDecisions = (): DecisionsRecord => ({
	planName: 'demo',
	decisions: [
		decisionRow({ question: 'Global constraint: every write goes through the store', choice: constraintChoice }),
		decisionRow({ question: 'Who owns the phase table?', choice: ordinaryChoice }),
	],
});

/** The record with no rows — what the shared bodies already render their own Decision Log from, so nothing about the log is stale. */
const noDecisions = (): DecisionsRecord => ({ planName: 'demo', decisions: [] });

/** One `##` section's body: the lines under its heading, up to the next `##` heading. */
const sectionOf = ({ text, heading }: { text: string; heading: string }) => {
	const lines = text.split('\n');
	const start = lines.indexOf(`## ${heading}`);

	if (start === -1) {
		return '';
	}

	const rest = lines.slice(start + 1);
	const next = rest.findIndex((line) => line.startsWith('## '));

	return (next === -1 ? rest : rest.slice(0, next)).join('\n');
};

/** The same file with one `##` section removed outright — a section the engine has to compose back. */
const withoutSection = ({ text, heading }: { text: string; heading: string }) => {
	const lines = text.split('\n');
	const start = lines.indexOf(`## ${heading}`);

	if (start === -1) {
		return text;
	}

	const rest = lines.slice(start + 1);
	const next = rest.findIndex((line) => line.startsWith('## '));

	return [...lines.slice(0, start), ...(next === -1 ? [] : rest.slice(next))].join('\n');
};

/** The checks whose fix is a judgment call no code can make — what the pass has to hand the agent untouched. */
const judgmentChecks = new Set<StructuralCheck>([StructuralCheck.PathExists, StructuralCheck.HandoffChained, StructuralCheck.DeclarationConsistent]);

/** Every judgment-dependent finding, in a stable order, reduced to the fields that identify it. */
const judgmentFindings = ({ findings }: { findings: StructuralFinding[] }) =>
	findings
		.filter((finding) => judgmentChecks.has(finding.check))
		.map(({ check, severity, phase, location }) => ({ check, severity, phase, location }))
		.sort((one, other) => JSON.stringify(one).localeCompare(JSON.stringify(other)));

/** Plant a file the plan claims already exists, so a `## Files to Modify` heading is not a broken reference. */
const plant = ({ cwd, paths }: { cwd: string; paths: string[] }) => {
	for (const path of paths) {
		mkdirSync(join(cwd, dirname(path)), { recursive: true });
		writeFileSync(join(cwd, path), 'export const planted = 1;\n');
	}
};

/** A consumer repo holding a single-file plan — no overview, so the deliverable has no phase table at all. */
const setupStandalonePlan = ({ body, decisions, existing = [] }: { body: string; decisions: DecisionsRecord; existing?: string[] }) => {
	const cwd = setupConsumerRepo();
	const dir = join(cwd, '.lightsout', 'work-orders', 'demo', 'plans');

	mkdirSync(dir, { recursive: true });
	plant({ cwd, paths: existing });

	const planPath = join(dir, 'plan.md');

	writeFileSync(planPath, body);

	return {
		cwd,
		name: 'demo',
		decisions,
		planPaths: [planPath],
		planPath,
		lint: () => lintPlanStructure({ cwd, planPaths: [planPath], decisions }),
		read: () => readFileSync(planPath, 'utf8'),
	};
};

/**
 * A phased deliverable the pass has already brought into step — its own first
 * run is the arrangement, so the overview carries exactly what the engine
 * composes — backdated so any rewrite on the next run would move its
 * modification time.
 */
const setupInStepDeliverable = async () => {
	const deliverable = setupPhasedDeliverable({
		decisions: noDecisions(),
		overview: overviewBody({ rows: [{ number: 1, file: 'phase1-core.md', created: 9, touched: 9, fileBudget: 9 }] }),
		phases: { 'phase1-core.md': phaseBody({ create: ['src/one.ts'], modify: ['src/two.ts'], fileBudget: 4 }) },
		existing: ['src/two.ts'],
	});

	await repairMechanicalFindings({
		cwd: deliverable.cwd,
		name: deliverable.name,
		planPaths: deliverable.planPaths,
		decisions: deliverable.decisions,
		overviewPath: deliverable.overviewPath,
	});

	const backdated = new Date('2020-01-01T00:00:00.000Z');

	utimesSync(deliverable.overviewPath, backdated, backdated);

	return { ...deliverable, original: deliverable.read({ base: 'overview.md' }), modifiedAt: statSync(deliverable.overviewPath).mtimeMs };
};

describe('repairMechanicalFindings', () => {
	test('composes every engine-owned section of a phased deliverable', async () => {
		const deliverable = setupPhasedDeliverable({
			decisions: settledDecisions(),
			// the overview carries no Global Constraints section at all, an estimate
			// for both counts, and a file budget its phase file disagrees with
			overview: withoutSection({
				text: overviewBody({
					rows: [
						{ number: 1, file: 'phase1-core.md', created: 9, touched: 9, fileBudget: 9 },
						{ number: 2, file: 'phase2-wire.md', created: 9, touched: 9 },
					],
				}),
				heading: 'Global Constraints',
			}),
			phases: {
				'phase1-core.md': phaseBody({ create: ['src/one.ts'], modify: ['src/two.ts'], fileBudget: 4 }),
				'phase2-wire.md': phaseBody({ modify: ['src/two.ts'] }),
			},
			existing: ['src/two.ts'],
		});
		const before = engineOwnedReported({ findings: await deliverable.lint() });

		await repairMechanicalFindings({
			cwd: deliverable.cwd,
			name: deliverable.name,
			planPaths: deliverable.planPaths,
			decisions: deliverable.decisions,
			overviewPath: deliverable.overviewPath,
		});

		const after = engineOwnedReported({ findings: await deliverable.lint() });

		// the same lint over the same deliverable, either side of the pass: each of
		// the four is a defect the engine can settle from a record, so none of them
		// may still be there to spend an agent attempt on
		expect({ before, after }).toStrictEqual({
			before: { decisionLog: true, globalConstraints: true, phaseCounts: true, phaseDeclarations: true },
			after: { decisionLog: false, globalConstraints: false, phaseCounts: false, phaseDeclarations: false },
		});
	});

	test('composes only the decision log and the constraints for a standalone plan', async () => {
		const plan = setupStandalonePlan({
			decisions: settledDecisions(),
			body: phaseBody({ modify: ['src/two.ts'], reference: false }),
			existing: ['src/two.ts'],
		});
		const before = engineOwnedReported({ findings: await plan.lint() });

		// resolving at all is half the criterion: with no overview there is no
		// `## Phases` table to stamp, and a stamp attempted against this file would
		// reject on the overview path it was never given
		const written = await repairMechanicalFindings({
			cwd: plan.cwd,
			name: plan.name,
			planPaths: plan.planPaths,
			decisions: plan.decisions,
		});

		const after = plan.read();
		const constraints = sectionOf({ text: after, heading: 'Global Constraints' });
		const relinted = engineOwnedReported({ findings: await plan.lint() });

		expect({
			written: [...new Set(written.map(({ path }) => path))],
			decisionLog: { before: before.decisionLog, after: relinted.decisionLog },
			statesConstraint: constraints.includes(constraintChoice),
			statesOrdinaryDecision: constraints.includes(ordinaryChoice),
			hasPhasesTable: parsePlan({ content: after, base: 'plan.md' }).sections.has('Phases'),
		}).toStrictEqual({
			written: [plan.planPath],
			decisionLog: { before: true, after: false },
			statesConstraint: true,
			statesOrdinaryDecision: false,
			hasPhasesTable: false,
		});
	});

	test('leaves every judgment-dependent finding for the agent to repair', async () => {
		const deliverable = setupPhasedDeliverable({
			decisions: noDecisions(),
			// every count and budget already agrees with its phase file, so the only
			// declaration defect left is the one no code can settle
			overview: overviewBody({
				rows: [
					{ number: 1, file: 'phase1-core.md', created: 1, touched: 2 },
					{ number: 2, file: 'phase2-wire.md', created: 0, touched: 3, fileBudget: 1 },
				],
			}),
			phases: {
				'phase1-core.md': phaseBody({ create: ['src/one.ts'], modify: ['src/missing.ts'], handsForward: 'Exporting `handedExport`.' }),
				'phase2-wire.md': phaseBody({ modify: ['src/two.ts', 'src/three.ts', 'src/four.ts'], fileBudget: 1 }),
			},
			existing: ['src/two.ts', 'src/three.ts', 'src/four.ts'],
		});
		const surviving = [
			{
				check: StructuralCheck.DeclarationConsistent,
				severity: FindingSeverity.Blocking,
				phase: 'overview.md',
				location: 'overview.md → Phase Declarations',
			},
			{
				check: StructuralCheck.HandoffChained,
				severity: FindingSeverity.Blocking,
				phase: 'phase2-wire.md',
				location: 'phase2-wire.md → Prerequisites',
			},
			{
				check: StructuralCheck.PathExists,
				severity: FindingSeverity.Blocking,
				phase: 'phase1-core.md',
				location: 'phase1-core.md → src/missing.ts',
			},
		];
		const before = judgmentFindings({ findings: await deliverable.lint() });

		await repairMechanicalFindings({
			cwd: deliverable.cwd,
			name: deliverable.name,
			planPaths: deliverable.planPaths,
			decisions: deliverable.decisions,
			overviewPath: deliverable.overviewPath,
		});

		const after = judgmentFindings({ findings: await deliverable.lint() });

		// a missing path, a hand-off nobody claims and a budget under the phase's own
		// work each need a choice between shrinking the phase and raising the number —
		// regenerating anything here would either paper one over or invent an answer
		expect({ before, after }).toStrictEqual({ before: surviving, after: surviving });
	});

	test('leaves an overview already in step unwritten', async () => {
		const deliverable = await setupInStepDeliverable();

		const written = await repairMechanicalFindings({
			cwd: deliverable.cwd,
			name: deliverable.name,
			planPaths: deliverable.planPaths,
			decisions: deliverable.decisions,
			overviewPath: deliverable.overviewPath,
		});

		// the stamp, the decision log, the constraints and the phase sections all
		// already agree with their records, so not one of them may touch the file:
		// its bytes and the backdated modification time both survive the pass
		expect({
			text: deliverable.read({ base: 'overview.md' }),
			modifiedAt: statSync(deliverable.overviewPath).mtimeMs,
			overviewUpdated: written.filter(({ path }) => path === deliverable.overviewPath).some(({ updated }) => updated),
		}).toStrictEqual({
			text: deliverable.original,
			modifiedAt: deliverable.modifiedAt,
			overviewUpdated: false,
		});
	});
});
