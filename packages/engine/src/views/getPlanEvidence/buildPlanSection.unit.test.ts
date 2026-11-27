import { expect, test } from '@jest/globals';
import { DecisionSource } from '#src/contracts/plan/decisions/DecisionSource.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { GapArea } from '#src/contracts/plan/grade/GapArea.ts';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import { PlanGrade } from '#src/contracts/plan/grade/PlanGrade.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import { PlanStage } from '#src/contracts/views/planWorkspace/PlanStage.ts';
import { PlanWorkspaceView } from '#src/contracts/views/planWorkspace/PlanWorkspaceView.ts';
import { buildPlanSection } from '#src/views/getPlanEvidence/buildPlanSection.ts';

const name = 'lo-16-evidence/001-plan';

const listing = {
	name,
	stage: PlanStage.Graded,
	hasNotes: false,
	hasPlanFile: true,
	implementedFiles: [],
	phased: false,
	phaseCount: 0,
	updatedAt: '2026-01-01T00:00:00.000Z',
	runCount: 0,
};

const decision = ({ assumption }: { assumption: boolean }) => ({
	source: DecisionSource.Elicitation,
	question: 'how do ties sort?',
	options: 'by id / by name',
	choice: 'by id',
	rationale: 'ids are stable',
	assumption,
});

const gap = { area: GapArea.OmittedDecision, gap: 'ties are unordered', decision: 'how do ties sort?', phase: 'plan.md', outcome: GapOutcome.NeedsAHuman };

const structural = {
	check: StructuralCheck.PathExists,
	severity: FindingSeverity.Blocking,
	phase: 'plan.md',
	issue: 'path is missing',
	location: 'Files to Modify',
	fix: 'name a real path',
};

const finding = ({ id, status }: { id: string; status: GradeFindingStatus }) => ({
	id,
	...gap,
	firstSeen: '2026-01-01T00:01:00.000Z',
	lastSeen: '2026-01-01T00:01:00.000Z',
	status,
});

/** A workspace view holding exactly the records a case states, every other field at its default. */
const setupPlanSection = ({ records, planningLive = false }: { records: boolean; planningLive?: boolean }) => {
	const workspace = PlanWorkspaceView.parse({
		listing,
		rootPath: '/repo/work-orders/lo-16-evidence/plans/001-plan',
		planningLive,
		...(records
			? {
					decisions: { planName: name, decisions: [decision({ assumption: false }), decision({ assumption: true }), decision({ assumption: true })] },
					facts: {
						request: 'show the evidence',
						verification: { pathsChecked: 12, missingPaths: ['src/gone.ts'], scriptsChecked: 3, missingScripts: [] },
						verifiedAt: '2026-01-01T00:00:00.000Z',
					},
					gradePasses: [
						{ gradedAt: '2026-01-01T00:01:00.000Z', grade: PlanGrade.BelowA, passed: false, structural: [structural], gaps: [gap, gap] },
						{ gradedAt: '2026-01-01T00:06:00.000Z', grade: PlanGrade.A, passed: true, structural: [], gaps: [] },
					],
					gradeFindings: [
						finding({ id: 'f1', status: GradeFindingStatus.Noted }),
						finding({ id: 'f2', status: GradeFindingStatus.Open }),
						finding({ id: 'f3', status: GradeFindingStatus.Open }),
					],
				}
			: {}),
	});

	return { workspace };
};

const recordedSection = {
	state: 'finished',
	gradePasses: [
		{
			gradedAt: '2026-01-01T00:01:00.000Z',
			grade: 'below-A',
			gaps: { value: 2, provenance: 'reported' },
			structural: { value: 1, provenance: 'measured' },
			provenance: 'reported',
		},
		{
			gradedAt: '2026-01-01T00:06:00.000Z',
			grade: 'A',
			gaps: { value: 0, provenance: 'reported' },
			structural: { value: 0, provenance: 'measured' },
			provenance: 'reported',
		},
	],
	findingsByStatus: [
		{ status: 'open', count: { value: 2, provenance: 'reported' } },
		{ status: 'noted', count: { value: 1, provenance: 'reported' } },
	],
	questionsAsked: { value: 1, provenance: 'measured' },
	answeredWithoutUser: { value: 2, provenance: 'measured' },
	pathsChecked: { value: 12, provenance: 'measured' },
	pathsMissing: { value: 1, provenance: 'measured' },
	scriptsChecked: { value: 3, provenance: 'measured' },
	scriptsMissing: { value: 0, provenance: 'measured' },
};

test.each([
	{ records: true, expected: recordedSection },
	{ records: false, expected: undefined },
])('buildPlanSection: counts questions, passes and verification with their provenance, absent with no records', ({ records, expected }) => {
	const { workspace } = setupPlanSection({ records });

	const section = buildPlanSection({ workspace });

	expect(section).toEqual(expected);
});

test('buildPlanSection: a plan still being planned is in progress before it records anything', () => {
	const { workspace } = setupPlanSection({ records: false, planningLive: true });

	const section = buildPlanSection({ workspace });

	expect(section).toEqual({
		state: 'in-progress',
		gradePasses: [],
		findingsByStatus: [],
		questionsAsked: undefined,
		answeredWithoutUser: undefined,
		pathsChecked: undefined,
		pathsMissing: undefined,
		scriptsChecked: undefined,
		scriptsMissing: undefined,
	});
});
