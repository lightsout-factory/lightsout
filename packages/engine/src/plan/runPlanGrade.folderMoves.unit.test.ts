import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { DriverInvocation } from '#src/common/types/DriverInvocation.ts';
import { runPlanGrade } from '#src/plan/runPlanGrade.ts';
import { createGapCheckDriver } from '#tests/helpers/createGapCheckDriver.ts';
import { expectStatus } from '#tests/helpers/expectStatus.ts';
import { gapCheckMarker } from '#tests/helpers/gradedThreePhasePlan.ts';
import { overviewBody, type PhaseSpec, phaseBody } from '#tests/helpers/phasePlan.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writePhasedPlanDeliverable } from '#tests/helpers/writePhasedPlanDeliverable.ts';

// How far a focused re-grade reaches when two phases are tied only by a folder
// move: a file the move carries is named nowhere in the moving phase, so no
// basename, export or hand-off links the two.

/** Committed files with no export, so the repo plants no consumer beside them. */
const sources = { 'src/old/a.ts': '// tracked\n', 'src/kept.ts': '// tracked\n', 'src/other.ts': '// tracked\n' };

/** The text that tells one phase's reader apart from the others', since a reader's prompt holds only its own phase. */
const readerMarkers = [
	{ marker: '`src/old/` → `src/new/`', file: 'phase1-move.md' },
	{ marker: 'phase two of the plan', file: 'phase2-edit.md' },
	{ marker: '`src/other.ts`', file: 'phase3-other.md' },
];

/** The plan files the gap-check readers in a collector were given, in deliverable order. */
const readerPhases = ({ invocations }: { invocations: DriverInvocation[] }): string[] => {
	const readers = invocations.filter(({ prompt }) => prompt.includes(gapCheckMarker));

	return readerMarkers.filter(({ marker }) => readers.some(({ prompt }) => prompt.includes(marker))).map(({ file }) => file);
};

/**
 * A three-phase plan graded once, then phase 2 edited: phase 1 moves `src/old/`
 * to `src/new/`, phase 2 is the spec the case gives, and phase 3 edits a file
 * neither of the others names. The overview counts are the expanded ones, so the
 * structural lint stays clean and the pass reaches the scope decision.
 */
const setupFolderMoveGraded = async ({ name, edit }: { name: string; edit: PhaseSpec }) => {
	const cwd = setupConsumerRepo({ sources });
	const phaseTwo = ({ note }: { note: string }) => phaseBody({ ...edit, note: `${note} This is phase two of the plan.` });
	const dir = writePhasedPlanDeliverable({
		cwd,
		name,
		files: {
			'overview.md': overviewBody({
				rows: [
					{ number: 1, file: 'phase1-move.md', created: 0, touched: 2 },
					{ number: 2, file: 'phase2-edit.md', created: 0, touched: 1 },
					{ number: 3, file: 'phase3-other.md', created: 0, touched: 1 },
				],
			}),
			'phase1-move.md': phaseBody({ move: [{ from: 'src/old/', to: 'src/new/' }] }),
			'phase2-edit.md': phaseTwo({ note: 'One phase of a phased plan.' }),
			'phase3-other.md': phaseBody({ modify: ['src/other.ts'] }),
		},
	});
	const invocations: DriverInvocation[] = [];
	const driver = createGapCheckDriver({ invocations });

	await runPlanGrade({ cwd, driver, name });

	invocations.length = 0;
	writeFileSync(join(dir, 'phase2-edit.md'), phaseTwo({ note: 'Repaired after the last pass.' }));

	return { cwd, name, driver, invocations };
};

describe('runPlanGrade', () => {
	test('plan grade: a focused pass reads the phase whose folder move carries a file the edited phase names', async () => {
		const { cwd, name, driver, invocations } = await setupFolderMoveGraded({ name: 'folder-move-closure', edit: { earlierModify: ['src/new/a.ts'] } });

		const result = await runPlanGrade({ cwd, driver, name });

		expectStatus(result, 'complete');
		// phase 2 edits a file phase 1's folder move carries, so a repair to phase 2
		// reaches phase 1 though the two share no basename; phase 3 stays unread
		expect({ readers: readerPhases({ invocations }), scope: result.grade.scope, focusedOn: result.grade.focusedOn }).toStrictEqual({
			readers: ['phase1-move.md', 'phase2-edit.md'],
			scope: 'focused',
			focusedOn: ['phase1-move.md', 'phase2-edit.md'],
		});
	});

	test('plan grade: a focused pass leaves a folder-moving phase unread when the edited phase names nothing under its folders', async () => {
		const { cwd, name, driver, invocations } = await setupFolderMoveGraded({ name: 'folder-move-apart', edit: { modify: ['src/kept.ts'] } });

		const result = await runPlanGrade({ cwd, driver, name });

		expectStatus(result, 'complete');
		// `src/kept.ts` lies under neither `src/old/` nor `src/new/`, so the folder
		// move ties phase 2 to nothing and the repair is read on its own
		expect({ readers: readerPhases({ invocations }), scope: result.grade.scope, focusedOn: result.grade.focusedOn }).toStrictEqual({
			readers: ['phase2-edit.md'],
			scope: 'focused',
			focusedOn: ['phase2-edit.md'],
		});
	});
});
