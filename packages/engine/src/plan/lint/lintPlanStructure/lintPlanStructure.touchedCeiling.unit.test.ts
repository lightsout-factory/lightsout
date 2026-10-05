import { expect, test } from '@jest/globals';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import { lintPlanStructure } from '#src/plan/lint/lintPlanStructure/lintPlanStructure.ts';
import { emptyDecisionsRecord } from '#tests/helpers/emptyDecisionsRecord.ts';
import { phaseBody } from '#tests/helpers/phasePlan.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writeDemoPlanFile } from '#tests/helpers/writeDemoPlanFile.ts';

/** `count` distinct source paths — distinct because the touched count drops duplicates. */
const touchedPaths = ({ count }: { count: number }) => Array.from({ length: count }, (_, index) => `src/touched${index}.ts`);

test('lintPlanStructure: a plan touching more source files than the touched ceiling is blocked, and the budget note still reads beside it', async () => {
	const cwd = setupConsumerRepo();
	const path = writeDemoPlanFile({
		cwd,
		name: 'too-wide.md',
		body: phaseBody({ create: ['src/gen0.ts'], modify: touchedPaths({ count: 70 }), reference: false }),
	});

	const findings = await lintPlanStructure({ cwd, planPaths: [path], decisions: emptyDecisionsRecord() });
	const ceiling = findings.filter((finding) => finding.check === StructuralCheck.TouchedFilesWithinCeiling);
	const guardrail = findings.filter((finding) => finding.check === StructuralCheck.ScopeWithinGuardrail);

	// 71 touched files is more than one implementing run finishes, got:
	// ${JSON.stringify(findings)}
	expect(ceiling).toEqual([
		expect.objectContaining({
			severity: FindingSeverity.Blocking,
			phase: 'too-wide.md',
			issue: expect.stringMatching(/touches 71 source files, over the 70-file ceiling/),
		}),
	]);
	expect(guardrail).toEqual([expect.objectContaining({ severity: FindingSeverity.Advisory })]);
});

test('lintPlanStructure: a plan touching exactly the touched ceiling keeps only the advisory note', async () => {
	const cwd = setupConsumerRepo();
	const path = writeDemoPlanFile({ cwd, name: 'seventy.md', body: phaseBody({ modify: touchedPaths({ count: 70 }), reference: false }) });

	const findings = await lintPlanStructure({ cwd, planPaths: [path], decisions: emptyDecisionsRecord() });
	const ceiling = findings.filter((finding) => finding.check === StructuralCheck.TouchedFilesWithinCeiling);
	const guardrail = findings.filter((finding) => finding.check === StructuralCheck.ScopeWithinGuardrail);

	// the ceiling is 70, not 69, got: ${JSON.stringify(findings)}
	expect(ceiling).toStrictEqual([]);
	expect(guardrail).toEqual([
		expect.objectContaining({
			severity: FindingSeverity.Advisory,
			issue: expect.stringMatching(/touches 70 source files, over the 50-file limit from the configured executor-file-limit/),
		}),
	]);
});

test("lintPlanStructure: a plan's own File Budget does not lift it past the touched ceiling", async () => {
	const cwd = setupConsumerRepo();
	const path = writeDemoPlanFile({ cwd, name: 'budgeted.md', body: phaseBody({ modify: touchedPaths({ count: 71 }), fileBudget: 200, reference: false }) });

	const findings = await lintPlanStructure({ cwd, planPaths: [path], decisions: emptyDecisionsRecord() });
	const ceiling = findings.filter((finding) => finding.check === StructuralCheck.TouchedFilesWithinCeiling);
	const guardrail = findings.filter((finding) => finding.check === StructuralCheck.ScopeWithinGuardrail);

	// an unbounded budget is what let a 77-file phase through, got:
	// ${JSON.stringify(findings)}
	expect(ceiling).toEqual([expect.objectContaining({ severity: FindingSeverity.Blocking, phase: 'budgeted.md' })]);
	expect(guardrail).toStrictEqual([]);
});

test('lintPlanStructure: a rename-only plan is exempt from the touched ceiling', async () => {
	const cwd = setupConsumerRepo();
	const path = writeDemoPlanFile({
		cwd,
		name: 'wide-rename.md',
		body: phaseBody({ modify: touchedPaths({ count: 71 }), renames: [{ from: 'one', to: 'uno' }], reference: false }),
	});

	const findings = await lintPlanStructure({ cwd, planPaths: [path], decisions: emptyDecisionsRecord() });
	const ceiling = findings.filter((finding) => finding.check === StructuralCheck.TouchedFilesWithinCeiling);

	// a rename's size is not what makes it hard, got: ${JSON.stringify(findings)}
	expect(ceiling).toStrictEqual([]);
});

test('lintPlanStructure: a move-folders-and-files plan is exempt from the touched ceiling and the over-budget advisory', async () => {
	const cwd = setupConsumerRepo();
	const move = Array.from({ length: 36 }, (_, index) => ({ from: `src/old${index}.ts`, to: `src/new${index}.ts` }));
	const path = writeDemoPlanFile({ cwd, name: 'wide-move.md', body: phaseBody({ move, buildMode: 'move-folders-and-files', reference: false }) });

	const findings = await lintPlanStructure({ cwd, planPaths: [path], decisions: emptyDecisionsRecord() });
	const sizes = findings.filter(
		(finding) => finding.check === StructuralCheck.TouchedFilesWithinCeiling || finding.check === StructuralCheck.ScopeWithinGuardrail,
	);

	// moves count on both sides, so these touch well past the 70-file ceiling and
	// the 50-file default budget — a mechanical move's size is not what makes it
	// hard, got: ${JSON.stringify(findings)}
	expect(sizes).toStrictEqual([]);
});

test('lintPlanStructure: the touched-ceiling fix for a standard plan points at both mechanical build modes', async () => {
	const cwd = setupConsumerRepo();
	const path = writeDemoPlanFile({ cwd, name: 'too-wide-standard.md', body: phaseBody({ modify: touchedPaths({ count: 71 }), reference: false }) });

	const findings = await lintPlanStructure({ cwd, planPaths: [path], decisions: emptyDecisionsRecord() });
	const ceiling = findings
		.filter((finding) => finding.check === StructuralCheck.TouchedFilesWithinCeiling)
		.map(({ severity, fix }) => ({
			severity,
			namesRenames: fix.includes('## Renames'),
			namesBuildMode: fix.includes('## Build Mode'),
			namesMoveMode: fix.includes('move-folders-and-files'),
		}));

	expect(ceiling).toStrictEqual([{ severity: FindingSeverity.Blocking, namesRenames: true, namesBuildMode: true, namesMoveMode: true }]);
});
