import { mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { BuildMode } from '#src/common/constants/BuildMode.ts';
import { parsePhaseDeclarations } from '#src/plan/common/phases/parsePhaseDeclarations.ts';
import { parsePlan } from '#src/plan/parsePlan/parsePlan.ts';
import { syncPhaseSectionsFromFiles } from '#src/plan/sections/syncPhaseSectionsFromFiles/syncPhaseSectionsFromFiles.ts';
import { declaredRecord } from '#tests/helpers/declaredRecord.ts';
import { type DeclarationSpec, overviewBody, type PhaseSpec, phaseBody } from '#tests/helpers/phasePlan.ts';

// The one rebuild of a phased overview's `## Phases` table and `## Phase
// Declarations` from its phase files, shared by the draft path, the repair path
// and `plan sync-phases`: the real counts are stamped first, each phase file's
// own budget and build mode are taken, and both sections are rendered
// from that one record. Only the overview is ever written, and only when it
// changes.

/** The `## Phases` table's data rows as they stand on disk; the header and separator rows have no integer first cell. */
const rowLines = ({ text }: { text: string }) => text.split('\n').filter((line) => /^\|\s*\d/.test(line));

/** The opening of the note `syncPhaseSections` heads each rendered section with; a hand-written overview carries neither copy. */
const composedNoteLines = ({ text }: { text: string }) => text.split('\n').filter((line) => line.startsWith('Composed by `lightsout plan draft`'));

/**
 * What the overview now declares, read back through the parser the lint uses —
 * the table and the blocks joined into one row per phase, without the line
 * provenance the parser records beside them.
 */
const declaredBy = ({ text }: { text: string }) =>
	declaredRecord({ declarations: parsePhaseDeclarations({ plan: parsePlan({ content: text, base: 'overview.md' }) }) });

const backdated = new Date('2020-01-01T00:00:00.000Z');

/** A plan workspace holding one authored overview and its phase files, every one backdated so any rewrite moves its modification time. */
const setupPhasedPlan = ({ rows, phases }: { rows: DeclarationSpec[]; phases: Record<string, PhaseSpec> }) => {
	const workspaceDir = mkdtempSync(join(tmpdir(), 'lightsout-phase-sync-files-'));
	const overviewPath = join(workspaceDir, 'overview.md');

	writeFileSync(overviewPath, overviewBody({ rows }), 'utf8');

	const phasePaths = Object.entries(phases).map(([base, spec]) => {
		const path = join(workspaceDir, base);

		writeFileSync(path, phaseBody(spec), 'utf8');

		return path;
	});
	const backdate = () => {
		for (const path of [overviewPath, ...phasePaths]) {
			utimesSync(path, backdated, backdated);
		}
	};

	backdate();

	return {
		cwd: workspaceDir,
		overviewPath,
		phasePaths,
		backdate,
		readOverview: () => readFileSync(overviewPath, 'utf8'),
		modifiedAt: () => statSync(overviewPath).mtimeMs,
		readPhases: () => phasePaths.map((path) => readFileSync(path, 'utf8')),
	};
};

describe('syncPhaseSectionsFromFiles', () => {
	test("stamps each phase's real counts and renders both overview sections from one record", async () => {
		const plan = setupPhasedPlan({
			rows: [
				{ number: 1, file: 'phase1-core.md', scope: 'the core', created: 9, touched: 9, creates: ['src/a.ts'], exports: ['buildA'] },
				{ number: 2, file: 'phase2-wire.md', scope: 'the wiring', created: 9, touched: 9 },
			],
			phases: {
				'phase1-core.md': { create: ['src/a.ts', 'src/b.ts'], modify: ['src/c.ts'] },
				'phase2-wire.md': { create: ['src/d.ts'], earlierModify: ['src/a.ts'], modify: ['src/e.ts', 'src/f.ts'] },
			},
		});

		const written = await syncPhaseSectionsFromFiles({ cwd: plan.cwd, overviewPath: plan.overviewPath, phasePaths: plan.phasePaths });

		const after = plan.readOverview();
		// the estimate said nine of each; the files say two created and three
		// touched, then one created and four touched. Reading both sections back
		// through the parser joins the table half and the block half into one row
		// per phase, and the composed note heading each section shows both were
		// rendered rather than the table alone being stamped
		expect({
			updated: written.updated,
			rows: rowLines({ text: after }),
			composedNotes: composedNoteLines({ text: after }).length,
			declared: declaredBy({ text: after }),
		}).toStrictEqual({
			updated: true,
			rows: ['| 1 | `phase1-core.md` | the core | 2 | 3 |', '| 2 | `phase2-wire.md` | the wiring | 1 | 4 |'],
			composedNotes: 2,
			declared: [
				{
					number: 1,
					file: 'phase1-core.md',
					scope: 'the core',
					createdCount: 2,
					touchedCount: 3,
					creates: ['src/a.ts'],
					exports: ['buildA'],
					scripts: [],
					fileBudget: undefined,
				},
				{
					number: 2,
					file: 'phase2-wire.md',
					scope: 'the wiring',
					createdCount: 1,
					touchedCount: 4,
					creates: [],
					exports: [],
					scripts: [],
					fileBudget: undefined,
				},
			],
		});
	});

	test("takes each phase file's own file budget and build mode into its declaration block", async () => {
		const plan = setupPhasedPlan({
			rows: [
				{ number: 1, file: 'phase1-core.md', created: 1, touched: 1 },
				{ number: 2, file: 'phase2-rename.md', created: 0, touched: 0 },
			],
			phases: {
				'phase1-core.md': { create: ['src/a.ts'] },
				'phase2-rename.md': { fileBudget: 14, renames: [{ from: 'oldName', to: 'newName' }] },
			},
		});

		const written = await syncPhaseSectionsFromFiles({ cwd: plan.cwd, overviewPath: plan.overviewPath, phasePaths: plan.phasePaths });

		const after = plan.readOverview();
		// the phase file is what the implementing agent is handed, so its budget
		// and build mode win over a block that carried neither; a phase file
		// declaring neither leaves its block without either bullet
		expect({
			updated: written.updated,
			hasBudgetBullet: after.includes('- **File budget:** 14'),
			hasRenamesOnlyBullet: after.includes('- **Renames only:** yes'),
			declared: declaredBy({ text: after }).map(({ file, fileBudget, buildMode }) => ({ file, fileBudget, buildMode })),
		}).toStrictEqual({
			updated: true,
			hasBudgetBullet: true,
			hasRenamesOnlyBullet: true,
			declared: [
				{ file: 'phase1-core.md', fileBudget: undefined, buildMode: undefined },
				{ file: 'phase2-rename.md', fileBudget: 14, buildMode: BuildMode.RenamesOnly },
			],
		});
	});

	test('writes nothing when the overview is already in step, and never writes a phase file', async () => {
		const plan = setupPhasedPlan({
			rows: [
				{ number: 1, file: 'phase1-core.md', created: 5, touched: 5 },
				{ number: 2, file: 'phase2-wire.md', created: 5, touched: 5 },
			],
			phases: {
				'phase1-core.md': { create: ['src/a.ts'], fileBudget: 11 },
				'phase2-wire.md': { modify: ['src/b.ts'], renames: [{ from: 'before', to: 'after' }] },
			},
		});
		const phasesAsAuthored = plan.readPhases();
		// the first sync is the arrangement: it is what brings the overview into
		// step, and backdating afterwards means a second write would show up
		await syncPhaseSectionsFromFiles({ cwd: plan.cwd, overviewPath: plan.overviewPath, phasePaths: plan.phasePaths });
		plan.backdate();
		const synced = plan.readOverview();
		const modifiedAt = plan.modifiedAt();

		const written = await syncPhaseSectionsFromFiles({ cwd: plan.cwd, overviewPath: plan.overviewPath, phasePaths: plan.phasePaths });

		// the phase files are compared against how they were authored, before the
		// first sync, so neither call may have touched one
		expect({
			updated: written.updated,
			text: plan.readOverview(),
			modifiedAt: plan.modifiedAt(),
			phases: plan.readPhases(),
		}).toStrictEqual({
			updated: false,
			text: synced,
			modifiedAt,
			phases: phasesAsAuthored,
		});
	});
});
