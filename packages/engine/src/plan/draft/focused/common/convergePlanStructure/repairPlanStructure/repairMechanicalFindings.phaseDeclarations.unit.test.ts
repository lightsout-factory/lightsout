import { describe, expect, test } from '@jest/globals';
import { BuildMode } from '#src/common/constants/BuildMode.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { parsePhaseDeclarations } from '#src/plan/common/phases/parsePhaseDeclarations.ts';
import { repairMechanicalFindings } from '#src/plan/draft/focused/common/convergePlanStructure/repairPlanStructure/repairMechanicalFindings.ts';
import { parsePlan } from '#src/plan/parsePlan/parsePlan.ts';
import { commitAll } from '#tests/helpers/commitAll.ts';
import { engineOwnedReported } from '#tests/helpers/engineOwnedReported.ts';
import { overviewBody, phaseBody } from '#tests/helpers/phasePlan.ts';
import { setupPhasedDeliverable } from '#tests/helpers/setupPhasedDeliverable.ts';

// The deterministic pass: everything the engine owns — the Decision Log, the
// Global Constraints, the stamped phase counts and the paired phase row and
// declaration block — regenerated in code before a repair round lints, so an
// agent attempt is never spent on bookkeeping. Every other finding is left
// exactly as it was for the agent round that follows.

/** The record with no rows — what the shared bodies already render their own Decision Log from, so nothing about the log is stale. */
const noDecisions = (): DecisionsRecord => ({ planName: 'demo', decisions: [] });

/**
 * The same overview with its last declaration block saying yes to both mode
 * bullets — a drafting mistake the shared helper's one-mode spec cannot write.
 */
const withBothModeBullets = ({ text }: { text: string }) =>
	text.replace('\n\n## Cross-Phase Dependencies', '\n- **Renames only:** yes\n- **Moves folders and files only:** yes\n\n## Cross-Phase Dependencies');

/**
 * A phased deliverable whose one phase moves a folder git tracks three files
 * under, committed so the expander lists them, with the overview still holding
 * the overview agent's estimate of nine of each.
 */
const setupFolderMovingDeliverable = () => {
	const deliverable = setupPhasedDeliverable({
		decisions: noDecisions(),
		overview: overviewBody({ rows: [{ number: 1, file: 'phase1-relocate.md', created: 9, touched: 9 }] }),
		phases: { 'phase1-relocate.md': phaseBody({ move: [{ from: 'src/old/', to: 'src/new/' }] }) },
		existing: ['src/old/a.ts', 'src/old/b.ts', 'src/old/deep/c.ts'],
	});

	commitAll({ cwd: deliverable.cwd, message: 'track the folder the phase moves' });

	return deliverable;
};

describe('repairMechanicalFindings', () => {
	test('renders the overview file budget from the phase file that declares it', async () => {
		const deliverable = setupPhasedDeliverable({
			decisions: noDecisions(),
			overview: overviewBody({ rows: [{ number: 1, file: 'phase1-core.md', created: 0, touched: 1, fileBudget: 9 }] }),
			phases: { 'phase1-core.md': phaseBody({ modify: ['src/two.ts'], fileBudget: 4 }) },
			existing: ['src/two.ts'],
		});

		await repairMechanicalFindings({
			cwd: deliverable.cwd,
			name: deliverable.name,
			planPaths: deliverable.planPaths,
			decisions: deliverable.decisions,
			overviewPath: deliverable.overviewPath,
		});

		const declarations = parsePhaseDeclarations({ plan: parsePlan({ content: deliverable.read({ base: 'overview.md' }), base: 'overview.md' }) });
		const phase = parsePlan({ content: deliverable.read({ base: 'phase1-core.md' }), base: 'phase1-core.md' });

		// the phase file is the copy the implementing agent is handed, so it is the
		// authoritative one — a pass that settled the disagreement the other way
		// round would leave both copies reading 9
		expect({ declared: declarations.map(({ file, fileBudget }) => ({ file, fileBudget })), ownBudget: phase.fileBudget }).toStrictEqual({
			declared: [{ file: 'phase1-core.md', fileBudget: 4 }],
			ownBudget: 4,
		});
	});

	test('copies whether each phase file declares renames onto its overview declaration block', async () => {
		const deliverable = setupPhasedDeliverable({
			decisions: noDecisions(),
			// both declaration blocks are wrong the opposite way round: the phase that
			// renames carries no Renames only bullet, and the phase that does not carries
			// a stale one — every count already agrees, so nothing else is in dispute
			overview: overviewBody({
				rows: [
					{ number: 1, file: 'phase1-rename.md', created: 0, touched: 1 },
					{ number: 2, file: 'phase2-wire.md', created: 0, touched: 1, buildMode: BuildMode.RenamesOnly },
				],
			}),
			phases: {
				'phase1-rename.md': phaseBody({ modify: ['src/two.ts'], renames: [{ from: 'oldName', to: 'newName' }] }),
				'phase2-wire.md': phaseBody({ modify: ['src/three.ts'] }),
			},
			existing: ['src/two.ts', 'src/three.ts'],
		});
		const renamesDisagreements = ({ findings }: { findings: StructuralFinding[] }) =>
			findings.filter((finding) => finding.check === StructuralCheck.DeclarationConsistent && /renames/i.test(finding.issue)).length;
		const before = renamesDisagreements({ findings: await deliverable.lint() });

		await repairMechanicalFindings({
			cwd: deliverable.cwd,
			name: deliverable.name,
			planPaths: deliverable.planPaths,
			decisions: deliverable.decisions,
			overviewPath: deliverable.overviewPath,
		});

		const after = renamesDisagreements({ findings: await deliverable.lint() });
		const declarations = parsePhaseDeclarations({ plan: parsePlan({ content: deliverable.read({ base: 'overview.md' }), base: 'overview.md' }) });

		// the phase file is the authoritative copy, as it is for the file budget: the
		// renaming phase gains the bullet, and the other loses its stale one outright
		// rather than being rewritten to say anything but yes
		expect({
			before,
			after,
			declared: declarations.map((declaration) => ({
				file: declaration.file,
				carriesBuildMode: Object.hasOwn(declaration, 'buildMode'),
				buildMode: declaration.buildMode,
			})),
		}).toStrictEqual({
			before: 2,
			after: 0,
			declared: [
				{ file: 'phase1-rename.md', carriesBuildMode: true, buildMode: 'renames-only' },
				{ file: 'phase2-wire.md', carriesBuildMode: false, buildMode: undefined },
			],
		});
	});

	test('repairMechanicalFindings: each overview block takes its build mode from its phase file, replacing a missing, stale or conflicting one', async () => {
		const deliverable = setupPhasedDeliverable({
			decisions: noDecisions(),
			// three blocks, each wrong a different way: the moving phase carries no mode
			// bullet, the standard phase a stale Renames only one, and the renaming phase
			// says yes to both bullets — every count already agrees, so nothing else is in
			// dispute, and no filename spells a mode word the issue match would catch
			overview: withBothModeBullets({
				text: overviewBody({
					rows: [
						{ number: 1, file: 'phase1-relocate.md', created: 0, touched: 2 },
						{ number: 2, file: 'phase2-wire.md', created: 0, touched: 1, buildMode: BuildMode.RenamesOnly },
						{ number: 3, file: 'phase3-retitle.md', created: 0, touched: 1 },
					],
				}),
			}),
			phases: {
				'phase1-relocate.md': phaseBody({ move: [{ from: 'src/old/a.ts', to: 'src/new/a.ts' }], buildMode: 'move-folders-and-files' }),
				'phase2-wire.md': phaseBody({ modify: ['src/three.ts'] }),
				'phase3-retitle.md': phaseBody({ modify: ['src/two.ts'], renames: [{ from: 'oldName', to: 'newName' }] }),
			},
			existing: ['src/old/a.ts', 'src/two.ts', 'src/three.ts'],
		});
		const buildModeDisagreements = ({ findings }: { findings: StructuralFinding[] }) =>
			findings.filter((finding) => finding.check === StructuralCheck.DeclarationConsistent && /renames|move/i.test(finding.issue)).length;
		const before = buildModeDisagreements({ findings: await deliverable.lint() });

		await repairMechanicalFindings({
			cwd: deliverable.cwd,
			name: deliverable.name,
			planPaths: deliverable.planPaths,
			decisions: deliverable.decisions,
			overviewPath: deliverable.overviewPath,
		});

		const after = buildModeDisagreements({ findings: await deliverable.lint() });
		const declarations = parsePhaseDeclarations({ plan: parsePlan({ content: deliverable.read({ base: 'overview.md' }), base: 'overview.md' }) });

		// the phase file is the authoritative copy: the moving phase gains its bullet,
		// the standard phase loses its stale one outright, and the conflicting block
		// keeps only the bullet its phase file's own mode names
		expect({
			before,
			after,
			declared: declarations.map((declaration) => ({
				file: declaration.file,
				carriesBuildMode: Object.hasOwn(declaration, 'buildMode'),
				buildMode: declaration.buildMode,
				carriesBuildModeConflict: Object.hasOwn(declaration, 'buildModeConflict'),
			})),
		}).toStrictEqual({
			before: 3,
			after: 0,
			declared: [
				{ file: 'phase1-relocate.md', carriesBuildMode: true, buildMode: 'move-folders-and-files', carriesBuildModeConflict: false },
				{ file: 'phase2-wire.md', carriesBuildMode: false, buildMode: undefined, carriesBuildModeConflict: false },
				{ file: 'phase3-retitle.md', carriesBuildMode: true, buildMode: 'renames-only', carriesBuildModeConflict: false },
			],
		});
	});

	test('composes the phases it has a file for when the overview declares one it does not', async () => {
		const deliverable = setupPhasedDeliverable({
			decisions: noDecisions(),
			// the second row names a file this deliverable does not have — what
			// `parsePhaseDeclarations` hands back rather than rejecting
			overview: overviewBody({
				rows: [
					{ number: 1, file: 'phase1-core.md', created: 0, touched: 1, fileBudget: 9 },
					{ number: 2, file: 'phase9-elsewhere.md', created: 4, touched: 4, fileBudget: 9 },
				],
			}),
			phases: { 'phase1-core.md': phaseBody({ modify: ['src/two.ts'], fileBudget: 4 }) },
			existing: ['src/two.ts'],
		});

		await repairMechanicalFindings({
			cwd: deliverable.cwd,
			name: deliverable.name,
			planPaths: deliverable.planPaths,
			decisions: deliverable.decisions,
			overviewPath: deliverable.overviewPath,
		});

		const declarations = parsePhaseDeclarations({ plan: parsePlan({ content: deliverable.read({ base: 'overview.md' }), base: 'overview.md' }) });

		// the budget substitution is defined only over rows a phase file was found
		// for, so the unmatched row never sends the pass looking for a file that is
		// not there — and the phase that does have one is still stamped from its own
		// file and given its own declared budget
		expect(declarations.find(({ file }) => file === 'phase1-core.md')).toEqual(
			expect.objectContaining({ file: 'phase1-core.md', fileBudget: 4, touchedCount: 1 }),
		);
	});

	test('repairMechanicalFindings: the stamped counts of a folder-moving phase agree with the lint, leaving no count finding', async () => {
		const deliverable = setupFolderMovingDeliverable();
		const before = engineOwnedReported({ findings: await deliverable.lint() }).phaseCounts;

		await repairMechanicalFindings({
			cwd: deliverable.cwd,
			name: deliverable.name,
			planPaths: deliverable.planPaths,
			decisions: deliverable.decisions,
			overviewPath: deliverable.overviewPath,
		});

		const after = engineOwnedReported({ findings: await deliverable.lint() }).phaseCounts;
		const declarations = parsePhaseDeclarations({ plan: parsePlan({ content: deliverable.read({ base: 'overview.md' }), base: 'overview.md' }) });

		// the stamp and the lint both count through the expander, so each of the three
		// carried files is touched on both sides: six touched, none created — a stamp
		// that counted the unexpanded heading would leave the lint disagreeing
		expect({
			before,
			after,
			declared: declarations.map(({ file, createdCount, touchedCount }) => ({ file, createdCount, touchedCount })),
		}).toStrictEqual({
			before: true,
			after: false,
			declared: [{ file: 'phase1-relocate.md', createdCount: 0, touchedCount: 6 }],
		});
	});
});
