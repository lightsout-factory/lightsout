import { describe, expect, test } from '@jest/globals';
import type { PhaseDeclaration } from '#src/common/types/PhaseDeclaration.ts';
import { getPhaseSetDefects } from '#src/plan/common/phases/getPhaseSetDefects.ts';

/** One overview row and its block, defaulted to a declaration that names nothing beyond its file. */
const declarationFor = ({ number, file }: { number: number; file: string }): PhaseDeclaration => ({
	number,
	file,
	scope: 'the work',
	createdCount: 0,
	touchedCount: 0,
	creates: [],
	exports: [],
	scripts: [],
});

const setupBreakdown = ({ rows, phaseFiles }: { rows: { number: number; file: string }[]; phaseFiles: string[] }) => ({
	declarations: rows.map((row) => declarationFor(row)),
	phaseFiles,
	overviewBase: 'overview.md',
});

describe('getPhaseSetDefects', () => {
	test("returns the lint's phase-set defects in the lint's exact words, from basenames alone", () => {
		const { declarations, phaseFiles, overviewBase } = setupBreakdown({
			rows: [
				{ number: 1, file: 'phase1-a.md' },
				{ number: 3, file: 'phase2-missing.md' },
			],
			phaseFiles: ['phase1-a.md', 'phase3-b.md'],
		});

		const defects = getPhaseSetDefects({ declarations, phaseFiles, overviewBase });

		expect(defects).toStrictEqual([
			{
				phase: 'overview.md',
				issue: "the phase breakdown declares 'phase2-missing.md', which is not one of this plan's phase files",
				location: 'overview.md → phase2-missing.md',
				fix: 'correct the filename, or drop the row and its declaration block',
			},
			{
				phase: 'phase3-b.md',
				issue: "this phase file has no row in the overview's phase breakdown",
				location: 'phase3-b.md',
				fix: "add a '## Phases' row and a '## Phase Declarations' block for phase3-b.md",
			},
			{
				phase: 'overview.md',
				issue: 'the phase numbers are 1, 3 rather than 1 to 2 with no gaps or duplicates',
				location: 'overview.md → Phases',
				fix: 'renumber the phases so they run 1..n in table order',
			},
			{
				phase: 'overview.md',
				issue: "phase 3 is declared in 'phase2-missing.md', whose name does not read phase3-<slug>.md",
				location: 'overview.md → phase2-missing.md',
				fix: 'rename the file or the row so the number and the filename agree',
			},
		]);
	});

	test('returns nothing for a breakdown whose files, rows and blocks line up', () => {
		const { declarations, phaseFiles, overviewBase } = setupBreakdown({
			rows: [
				{ number: 1, file: 'phase1-a.md' },
				{ number: 2, file: 'phase2-b.md' },
			],
			phaseFiles: ['phase1-a.md', 'phase2-b.md'],
		});

		const defects = getPhaseSetDefects({ declarations, phaseFiles, overviewBase });

		expect(defects).toStrictEqual([]);
	});
});
