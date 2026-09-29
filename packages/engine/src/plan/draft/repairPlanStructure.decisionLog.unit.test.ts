import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { DecisionSource } from '#src/contracts/plan/decisions/DecisionSource.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { SyncedPlanFile } from '#src/plan/common/types/SyncedPlanFile.ts';
import { repairPlanStructure } from '#src/plan/draft/repairPlanStructure.ts';
import { cleanPlanBody } from '#tests/helpers/cleanPlanBody.ts';
import { dirtyPlanBody } from '#tests/helpers/dirtyPlanBody.ts';
import { emptyDecisionsRecord } from '#tests/helpers/emptyDecisionsRecord.ts';
import { expectStatus } from '#tests/helpers/expectStatus.ts';
import { createRepairDriver, runRepairLoop, setupRepairDraft } from '#tests/helpers/repairDraftFixture.ts';

// The Decision Log the repair loop owns: the mechanical pass that runs ahead of
// every lint, and the merged record the draft hands down instead of a second read of
// the workspace.

// Mocked Imports
// -------------------------
/** The deterministic pass as the repair loop calls it: the draft's own paths and record, plus the overview of a phased deliverable. */
interface MechanicalParams {
	cwd: string;
	name: string;
	planPaths: string[];
	decisions: DecisionsRecord;
	overviewPath?: string;
}

const mockRepairMechanicalFindings = jest.fn<(params: MechanicalParams) => Promise<SyncedPlanFile[]>>();

jest.mock('#src/plan/draft/repairMechanicalFindings.ts', () => ({
	repairMechanicalFindings: (params: MechanicalParams) => mockRepairMechanicalFindings(params),
}));
// -------------------------

// Every round of the loop runs the pass before it lints, so the double stands in
// for every case in this file; the cases that measure it re-wire it themselves.
mockRepairMechanicalFindings.mockResolvedValue([]);

/**
 * A drafted plan whose mechanical pass stands in for the engine's own: every
 * call clears `strips` from each file it is handed, so a marker the pass clears
 * can only reach the lint — and the repairer — if the lint ran first.
 */
const setupMechanicalDraft = ({ body, strips }: { body: string; strips?: string }) => {
	const draft = setupRepairDraft({ body });

	mockRepairMechanicalFindings.mockImplementation(async ({ planPaths }) => {
		if (strips !== undefined) {
			for (const path of planPaths) {
				writeFileSync(path, readFileSync(path, 'utf8').replace(`${strips} `, ''));
			}
		}

		return planPaths.map((path) => ({ path, updated: true }));
	});

	return draft;
};

/** A merged record carrying one settled row — a history the clean skeleton, whose log is rendered from an empty record, does not carry. */
const recordWithOneRow = (): DecisionsRecord => ({
	planName: 'demo',
	decisions: [
		{
			source: DecisionSource.Grill,
			question: 'Does the repair loop lint against the record it was handed?',
			options: 'the handed record / a second read of the workspace',
			choice: 'the handed record',
			rationale: 'the draft holds the one merged record it was started from',
			assumption: false,
		},
	],
});

/** A merged record whose row came from the brainstorm — a row the plan's own decisions.json never holds, and this workspace holds no decisions.json at all. */
const mergedRecordWithBrainstormRow = (): DecisionsRecord => ({
	planName: 'demo',
	decisions: [
		{
			source: DecisionSource.Brainstorm,
			question: 'Which record does the repair loop lint against?',
			options: 'the merged record the draft holds / the workspace file',
			choice: 'the merged record the draft holds',
			rationale: 'the brainstorm rows are only in the merged set',
			assumption: false,
		},
	],
});

describe('repairPlanStructure decision log', () => {
	test("repairPlanStructure: the loop's lint is given the merged decision record", async () => {
		// the clean skeleton's Decision Log is rendered from an empty record, so a
		// record carrying one row is a log the plan on disk disagrees with
		const draft = setupRepairDraft({ body: cleanPlanBody() });
		const prompts: string[] = [];
		const driver = createRepairDriver({
			onCall: (prompt) => prompts.push(prompt),
			respond: () => ({
				text: JSON.stringify({ status: 'error', filesEdited: [], discrepancies: ['the Decision Log is composed by the sync command, not by a repair'] }),
				exitCode: 0,
			}),
		});

		const result = await runRepairLoop({ ...draft, driver, decisions: recordWithOneRow() });

		expectStatus(result, 'complete');
		// the record travels into the loop's own lint, so the staleness it creates
		// is a finding the repairer is handed rather than one nobody ever sees
		expect(prompts[0]).toContain(`[${StructuralCheck.DecisionLogCurrent}]`);
		expect('findings' in result && result.findings.map(({ check, severity }) => ({ check, severity }))).toStrictEqual([
			{ check: StructuralCheck.DecisionLogCurrent, severity: FindingSeverity.Blocking },
		]);
	});

	test('every repair round runs the mechanical pass before it re-lints', async () => {
		// Four planted markers, one of them cleared by the pass — and every repair
		// re-introduces it, the way a repair that displaces the engine's section
		// does. 3 → 2 → 1 → 0 findings, so all three repairs run.
		const draft = setupMechanicalDraft({ body: dirtyPlanBody({ markers: 'TBD TODO ??? {token}' }), strips: 'TBD' });
		const messages: string[] = [];
		const driver = createRepairDriver({
			bodies: [dirtyPlanBody({ markers: 'TBD TODO ???' }), dirtyPlanBody({ markers: 'TBD TODO' }), dirtyPlanBody({ markers: 'TBD' })],
		});

		const result = await runRepairLoop({ ...draft, driver, progress: (message) => messages.push(message) });

		expectStatus(result, 'complete');
		// three rounds plus the opening check
		expect(mockRepairMechanicalFindings).toHaveBeenCalledTimes(4);
		// the counts prove the order: a lint that ran first would have counted the
		// re-introduced marker and narrated 4, 3 and 2 findings instead
		expect(messages).toEqual([
			expect.stringMatching(/3 structural finding\(s\).*repair 1\/3/),
			expect.stringMatching(/2 structural finding\(s\).*repair 2\/3/),
			expect.stringMatching(/1 structural finding\(s\).*repair 3\/3/),
		]);
		// and the plan the loop hands back is clean, though every repairer output
		// carried the marker the pass cleared
		expect('findings' in result && result.findings).toStrictEqual([]);
	});

	test("the lint is handed the draft's merged decisions rather than re-reading them", async () => {
		// The clean skeleton's log is rendered from an empty record, and the
		// workspace holds no decisions.json at all: a lint that read the workspace
		// would find no rows and call this log current.
		const draft = setupMechanicalDraft({ body: cleanPlanBody() });
		const driver = createRepairDriver({
			respond: () => ({
				text: JSON.stringify({ status: 'error', filesEdited: [], discrepancies: ['the Decision Log is composed by the engine, not by a repair'] }),
				exitCode: 0,
			}),
		});

		const result = await runRepairLoop({ ...draft, driver, decisions: mergedRecordWithBrainstormRow() });

		expectStatus(result, 'complete');
		// the brainstorm row reached the lint, so the log that does not carry it is
		// the blocking staleness the loop reports
		expect('findings' in result && result.findings.map(({ check, severity }) => ({ check, severity }))).toStrictEqual([
			{ check: StructuralCheck.DecisionLogCurrent, severity: FindingSeverity.Blocking },
		]);
		expect('findings' in result && result.findings[0]?.issue).toMatch(/saved decision records/);
	});

	test("the pass is handed the draft's own paths and merged record, so it resolves neither for itself", async () => {
		// This workspace holds no decisions.json and no resolvable deliverable: a
		// pass left to read the record or to resolve the plan would compose from
		// nothing, so the loop states both.
		const draft = setupMechanicalDraft({ body: cleanPlanBody() });
		const driver = createRepairDriver({
			respond: () => ({
				text: JSON.stringify({ status: 'error', filesEdited: [], discrepancies: ['the Decision Log is composed by the engine, not by a repair'] }),
				exitCode: 0,
			}),
		});

		const result = await runRepairLoop({ ...draft, driver, decisions: mergedRecordWithBrainstormRow() });

		expectStatus(result, 'complete');
		expect(mockRepairMechanicalFindings).toHaveBeenCalledWith({
			cwd: draft.cwd,
			name: 'demo',
			planPaths: [draft.planPath],
			decisions: mergedRecordWithBrainstormRow(),
			overviewPath: undefined,
		});
	});

	test('runs the mechanical pass each round and spawns the agent only for what survives', async () => {
		// Two planted markers, one of them cleared by the mechanical pass. A lint
		// that ran first would hand the repairer both.
		const draft = setupMechanicalDraft({ body: dirtyPlanBody({ markers: 'TBD TODO' }), strips: 'TBD' });
		const overviewPath = join(draft.workspaceDir, 'overview.md');
		const prompts: string[] = [];
		const driver = createRepairDriver({ onCall: (prompt) => prompts.push(prompt), bodies: [cleanPlanBody()] });

		const result = await repairPlanStructure({
			cwd: draft.cwd,
			driver,
			name: 'demo',
			planPaths: [draft.planPath],
			workspaceDir: draft.workspaceDir,
			decisions: emptyDecisionsRecord(),
			timeoutMs: 60_000,
			progress: () => {},
			overviewPath,
		});

		expectStatus(result, 'complete');
		// the opening check plus the one after the repair — the pass runs every round
		expect(mockRepairMechanicalFindings).toHaveBeenCalledTimes(2);
		expect(mockRepairMechanicalFindings).toHaveBeenCalledWith({
			cwd: draft.cwd,
			name: 'demo',
			planPaths: [draft.planPath],
			decisions: emptyDecisionsRecord(),
			overviewPath,
		});
		// the pass stands in place of the bare Decision Log sync, which composes
		// the log itself rather than beside it
		// one spawn, carrying the survivor and not the finding the pass had
		// already repaired
		expect(prompts).toHaveLength(1);
		expect(prompts[0]).toContain("unresolved placeholder 'TODO' present");
		expect(prompts[0]).not.toContain("unresolved placeholder 'TBD' present");
		expect('findings' in result && result.findings).toStrictEqual([]);
	});
});
