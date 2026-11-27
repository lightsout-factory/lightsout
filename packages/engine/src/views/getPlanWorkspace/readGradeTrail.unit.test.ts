import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { GapArea } from '#src/contracts/plan/grade/GapArea.ts';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import { PlanGrade } from '#src/contracts/plan/grade/PlanGrade.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import { readPlanWorkspaceFiles } from '#src/views/common/readPlanWorkspaceFiles.ts';
import { readGradeTrail } from '#src/views/getPlanWorkspace/readGradeTrail.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { planWorkspaceFolder } from '#tests/helpers/planWorkspaceFolder.ts';

const name = 'add-search/001-plan';

const gap = { area: GapArea.OmittedDecision, gap: 'ties are unordered', decision: 'how do ties sort?', phase: 'plan.md' };

/** One pass as the grader appends it: a whole report, most of which the page never needs. */
const pass = ({ gradedAt, grade, gaps }: { gradedAt: string; grade: PlanGrade; gaps: object[] }) =>
	JSON.stringify({ planName: name, grade, passed: grade === PlanGrade.A, gradedAt, scopeComplete: true, scope: 'full', covered: ['plan.md'], gaps });

const finding = {
	id: 'f1',
	...gap,
	firstSeen: '2026-01-01T00:00:00.000Z',
	lastSeen: '2026-01-01T00:00:00.000Z',
	status: GradeFindingStatus.Resolved,
	disposition: GapOutcome.NeedsAHuman,
	resolutions: [{ phase: 'plan.md', answerAt: '| 4 | Converge | ties sort by id |', verifiedAt: '2026-01-01T00:05:00.000Z' }],
};

const memory = JSON.stringify({ planName: name, findings: [finding], coverage: { readers: [] }, updatedAt: '2026-01-01T00:05:00.000Z' });

const history = [
	pass({ gradedAt: '2026-01-01T00:01:00.000Z', grade: PlanGrade.BelowA, gaps: [{ ...gap, outcome: GapOutcome.NeedsAHuman, findingId: 'f1' }] }),
	pass({ gradedAt: '2026-01-01T00:06:00.000Z', grade: PlanGrade.A, gaps: [] }),
];

/** The trail of one workspace on disk holding exactly the files a case states. */
const setupGradeTrail = async ({ files }: { files: Record<string, string> }) => {
	const cwd = await freshCwd();
	const rootPath = planWorkspaceFolder({ cwd, name });

	await mkdir(rootPath, { recursive: true });

	for (const [file, body] of Object.entries(files)) {
		await writeFile(join(rootPath, file), body, 'utf8');
	}

	return readGradeTrail({ rootPath, files: await readPlanWorkspaceFiles({ cwd, name }) });
};

test('hands back every pass oldest first, narrowed to what a reader needs, and every finding the memory keeps', async () => {
	const trail = await setupGradeTrail({ files: { 'grade-history.jsonl': `${history.join('\n')}\n`, 'grade-memory.json': memory } });

	expect(trail).toStrictEqual({
		gradePasses: [
			{
				gradedAt: '2026-01-01T00:01:00.000Z',
				grade: PlanGrade.BelowA,
				passed: false,
				complete: true,
				structural: [],
				gaps: [{ ...gap, options: [], observations: [], outcome: GapOutcome.NeedsAHuman, findingId: 'f1' }],
			},
			{ gradedAt: '2026-01-01T00:06:00.000Z', grade: PlanGrade.A, passed: true, complete: true, structural: [], gaps: [] },
		],
		gradeFindings: [{ ...finding, options: [], observations: [], reopened: [] }],
		problem: undefined,
	});
});

test('a workspace graded nowhere has no passes, no findings and no problem', async () => {
	const trail = await setupGradeTrail({ files: { 'plan.md': '# plan' } });

	expect(trail).toStrictEqual({ gradePasses: [], gradeFindings: [], problem: undefined });
});

test('a ledger line caught mid-write is skipped, and the passes around it still read', async () => {
	const trail = await setupGradeTrail({ files: { 'grade-history.jsonl': `${history[0]}\n{ "planName": "add-se` } });

	expect(trail.gradePasses.map((entry) => entry.gradedAt)).toStrictEqual(['2026-01-01T00:01:00.000Z']);
});

test('a corrupt memory is a problem the page can show, and leaves the findings empty', async () => {
	const trail = await setupGradeTrail({ files: { 'grade-memory.json': '{ not json' } });

	expect(trail).toStrictEqual({ gradePasses: [], gradeFindings: [], problem: 'grade-memory.json is not valid JSON' });
});
