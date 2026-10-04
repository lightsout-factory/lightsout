import { describe, expect, test } from '@jest/globals';
import { BuildMode } from '#src/common/constants/BuildMode.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import { checkPhaseBreakdown } from '#src/plan/lint/checkPhaseBreakdown.ts';
import { setupPhaseBreakdown } from '#tests/helpers/setupPhaseBreakdown.ts';

describe('checkPhaseBreakdown', () => {
	test('a phase declaring more touched files than the configured limit is advisory, naming that limit as the source', () => {
		const params = setupPhaseBreakdown({ rows: [{ number: 1, file: 'phase1-core.md', created: 1, touched: 51 }], executorFileLimit: 50 });

		const findings = checkPhaseBreakdown(params);

		// touching many files is legal work — refusing it would park every
		// mechanical rename phase
		expect(findings.map(({ check, severity, issue }) => ({ check, severity, issue }))).toEqual([
			{
				check: StructuralCheck.ScopeWithinGuardrail,
				severity: FindingSeverity.Advisory,
				issue: expect.stringContaining('touch 51 source files, over the 50-file limit from the configured executor-file-limit'),
			},
		]);
	});

	test('a phase over its own declared budget names that budget rather than the configured limit', () => {
		const params = setupPhaseBreakdown({ rows: [{ number: 1, file: 'phase1-core.md', created: 1, touched: 21, fileBudget: 20 }], executorFileLimit: 50 });

		const findings = checkPhaseBreakdown(params);

		expect(findings.map(({ check, severity, issue }) => ({ check, severity, issue }))).toEqual([
			{
				check: StructuralCheck.ScopeWithinGuardrail,
				severity: FindingSeverity.Advisory,
				issue: expect.stringContaining("over the 20-file limit from phase1-core.md's own declared file budget"),
			},
		]);
	});

	test('a declared budget covering the declared touched count silences the note, however far over the configured limit', () => {
		const params = setupPhaseBreakdown({ rows: [{ number: 1, file: 'phase1-core.md', created: 1, touched: 70, fileBudget: 200 }], executorFileLimit: 50 });

		const findings = checkPhaseBreakdown(params);

		// declaring a budget is how a deliberately mechanical phase says so
		expect(findings).toStrictEqual([]);
	});

	test('a phase declaring more touched files than the touched ceiling is blocking, naming the phase, its count and the ceiling', () => {
		const params = setupPhaseBreakdown({ rows: [{ number: 1, file: 'phase1-core.md', created: 1, touched: 71 }], executorFileLimit: 50 });

		const findings = checkPhaseBreakdown(params);

		// 70 is the fixed touched ceiling; the advisory budget note still reads beside it
		expect(findings.map(({ check, severity, location, issue }) => ({ check, severity, location, issue }))).toEqual([
			{
				check: StructuralCheck.TouchedFilesWithinCeiling,
				severity: FindingSeverity.Blocking,
				location: 'overview.md → Phases → phase1-core.md',
				issue: expect.stringMatching(/phase1-core\.md.*\b71\b.*70-file ceiling/),
			},
			{
				check: StructuralCheck.ScopeWithinGuardrail,
				severity: FindingSeverity.Advisory,
				location: 'overview.md → Phases → phase1-core.md',
				issue: expect.stringContaining('touch 71 source files, over the 50-file limit'),
			},
		]);
	});

	test('a phase declaring exactly the touched ceiling is silent — the ceiling is the last legal count', () => {
		const params = setupPhaseBreakdown({ rows: [{ number: 1, file: 'phase1-core.md', created: 1, touched: 70, fileBudget: 70 }], executorFileLimit: 50 });

		const findings = checkPhaseBreakdown(params);

		expect(findings).toStrictEqual([]);
	});

	test('a declared file budget never lifts a phase past the touched ceiling', () => {
		const params = setupPhaseBreakdown({ rows: [{ number: 1, file: 'phase1-core.md', created: 1, touched: 120, fileBudget: 200 }], executorFileLimit: 50 });

		const findings = checkPhaseBreakdown(params);

		// the budget silences the advisory note but cannot raise the fixed ceiling
		expect(findings.map(({ check, severity, location }) => ({ check, severity, location }))).toStrictEqual([
			{
				check: StructuralCheck.TouchedFilesWithinCeiling,
				severity: FindingSeverity.Blocking,
				location: 'overview.md → Phases → phase1-core.md',
			},
		]);
	});

	test.each([
		{ fileBudget: 200, expected: [] },
		{ fileBudget: undefined, expected: [{ check: StructuralCheck.ScopeWithinGuardrail, severity: FindingSeverity.Advisory }] },
	])('a rename-only phase is exempt from the touched ceiling however many files it declares', ({ fileBudget, expected }) => {
		const params = setupPhaseBreakdown({
			rows: [{ number: 1, file: 'phase1-core.md', created: 0, touched: 120, fileBudget, buildMode: BuildMode.RenamesOnly }],
			executorFileLimit: 50,
		});

		const findings = checkPhaseBreakdown(params);

		// a rename's size is not what makes it hard; only the advisory budget note may still read
		expect(findings.map(({ check, severity }) => ({ check, severity }))).toStrictEqual(expected);
	});

	test('checkPhaseBreakdown: a move-folders-and-files phase is exempt from the touched ceiling and the over-budget advisory, and a rename-only phase only from the ceiling', () => {
		const params = setupPhaseBreakdown({
			rows: [
				{ number: 1, file: 'phase1-move.md', created: 0, touched: 300, buildMode: BuildMode.MoveFoldersAndFiles },
				{ number: 2, file: 'phase2-rename.md', created: 0, touched: 120, buildMode: BuildMode.RenamesOnly },
			],
			executorFileLimit: 50,
		});

		const findings = checkPhaseBreakdown(params);

		// neither phase declares a budget: only the rename-only phase still earns the advisory note
		expect(findings.map(({ check, severity, location }) => ({ check, severity, location }))).toStrictEqual([
			{
				check: StructuralCheck.ScopeWithinGuardrail,
				severity: FindingSeverity.Advisory,
				location: 'overview.md → Phases → phase2-rename.md',
			},
		]);
	});

	test('checkPhaseBreakdown: the touched-ceiling fix for a standard phase names both mechanical mode bullets', () => {
		const params = setupPhaseBreakdown({ rows: [{ number: 1, file: 'phase1-core.md', created: 1, touched: 71, fileBudget: 71 }], executorFileLimit: 50 });

		const findings = checkPhaseBreakdown(params);

		expect(
			findings.map(({ check, severity, location, fix }) => ({
				check,
				severity,
				location,
				namesRenamesOnly: fix.includes('Renames only'),
				namesMovesOnly: fix.includes('Moves folders and files only'),
			})),
		).toStrictEqual([
			{
				check: StructuralCheck.TouchedFilesWithinCeiling,
				severity: FindingSeverity.Blocking,
				location: 'overview.md → Phases → phase1-core.md',
				namesRenamesOnly: true,
				namesMovesOnly: true,
			},
		]);
	});

	test('checkPhaseBreakdown: a block declaring both build modes is one blocking finding', () => {
		const params = setupPhaseBreakdown({
			rows: [{ number: 1, file: 'phase1-core.md', created: 1, touched: 71, fileBudget: 71 }],
			executorFileLimit: 50,
			overview: ({ text }) => text.replace('- **Scripts:** none', '- **Scripts:** none\n- **Renames only:** yes\n- **Moves folders and files only:** yes'),
		});

		const findings = checkPhaseBreakdown(params);

		// a block naming both modes declares neither, so the touched ceiling still binds it
		expect(findings.map(({ check, severity, location }) => ({ check, severity, location }))).toStrictEqual([
			{
				check: StructuralCheck.DeclarationConsistent,
				severity: FindingSeverity.Blocking,
				location: 'overview.md → Phase Declarations',
			},
			{
				check: StructuralCheck.TouchedFilesWithinCeiling,
				severity: FindingSeverity.Blocking,
				location: 'overview.md → Phases → phase1-core.md',
			},
		]);
	});
});
