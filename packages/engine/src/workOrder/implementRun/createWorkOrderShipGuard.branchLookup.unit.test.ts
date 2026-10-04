import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/common/state/updateLocalWorkOrderState.ts';
import { createWorkOrderShipGuard } from '#src/workOrder/implementRun/createWorkOrderShipGuard.ts';

/** The work order's label: the folder its record sits in. */
const name = 'lo-140-multi';
/** The branch the record saves, which carries a prefix the label does not. */
const branch = `feature/${name}`;
const mergeCommit = 'a1b2c3d4e5f6';
const planIds = ['001-search-basics', '002-fix-x'];
const firstEvent = { at: '2026-01-01T00:00:00.000Z', kind: WorkOrderEventKind.PlanAdded, detail: 'added plan 001-search-basics' };

/** No `ticket-tracker` block, so the record is local only and nothing is reached for. */
const localConfig: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

const implementedPlanOf = ({ id }: { id: string }): WorkOrderPlan => ({
	id,
	title: id,
	progress: PlanProgress.Implemented,
	createdAt: '2026-01-01T00:00:00.000Z',
});

/**
 * A checkout outside any repository, so the shared state directory is its own,
 * holding one multiple-plan record labelled `lo-140-multi` that saves branch
 * `feature/lo-140-multi`, and the guard built over it.
 */
const setupBranchLookup = async ({ shipRequest }: { shipRequest?: string[] } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-ship-guard-branch-'));
	const workOrdersFolder = join(cwd, '.lightsout', 'work-orders');
	const record: WorkOrderState = {
		schemaVersion: 1,
		name,
		ticketRef: 'LO-140',
		branch,
		mode: WorkOrderMode.MultiplePlan,
		plans: planIds.map((id) => implementedPlanOf({ id })),
		...(shipRequest === undefined ? {} : { shipRequest: { planIds: shipRequest, requestedAt: '2026-01-03T00:00:00.000Z' } }),
		history: [firstEvent],
	};
	const seeded = await updateLocalWorkOrderState({ cwd, name, change: () => record });

	if ('error' in seeded) {
		throw new Error(seeded.error);
	}

	return {
		cwd,
		workOrdersFolder,
		recordPath: join(workOrdersFolder, name, 'state.json'),
		guard: createWorkOrderShipGuard({ config: localConfig, env: {} }),
	};
};

/**
 * A checkout holding one multiple-plan record with no ship request, labelled
 * `lo-140-multi` but saving another branch, `lo-140-renamed`, so no local record
 * saves branch `lo-140-multi` and only the fallback to the branch's own name
 * reaches the record.
 */
const setupRenamedBranch = async () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-ship-guard-renamed-'));
	const record: WorkOrderState = {
		schemaVersion: 1,
		name,
		ticketRef: 'LO-140',
		branch: 'lo-140-renamed',
		mode: WorkOrderMode.MultiplePlan,
		plans: planIds.map((id) => implementedPlanOf({ id })),
		history: [firstEvent],
	};
	const seeded = await updateLocalWorkOrderState({ cwd, name, change: () => record });

	if ('error' in seeded) {
		throw new Error(seeded.error);
	}

	return { cwd, guard: createWorkOrderShipGuard({ config: localConfig, env: {} }) };
};

describe('createWorkOrderShipGuard', () => {
	test('authorizes and refuses a branch by the record that saves it when the branch carries a prefix its label does not', async () => {
		const { guard, cwd } = await setupBranchLookup();

		const unrequested = await guard.authorize({ cwd, branch });
		const requested = await updateLocalWorkOrderState({
			cwd,
			name,
			change: (current) =>
				current === undefined ? { error: 'the row seeded a record' } : { ...current, shipRequest: { planIds, requestedAt: '2026-01-03T00:00:00.000Z' } },
		});
		const afterRequesting = await guard.authorize({ cwd, branch });

		// The same record answers both ways on its ship request alone, so the
		// refusal can only have come from the record the branch is saved on.
		expect({ unrequested, requested: 'error' in requested ? requested.error : 'written', afterRequesting }).toEqual({
			unrequested: expect.stringContaining(`lightsout work-order request-ship --name ${name}`),
			requested: 'written',
			afterRequesting: undefined,
		});
	});

	test('records the merge on the record that saves the branch, not on a folder named after the branch', async () => {
		const { guard, cwd, recordPath, workOrdersFolder } = await setupBranchLookup({ shipRequest: planIds });

		await guard.recordShipped({ cwd, branch, mergeCommit });

		const stored = JSON.parse(readFileSync(recordPath, 'utf8')) as WorkOrderState;

		expect({ stored, branchFolder: existsSync(join(workOrdersFolder, 'feature')) }).toEqual({
			stored: expect.objectContaining({
				shipped: { at: expect.any(String), planIds, mergeCommit },
				history: [firstEvent, expect.objectContaining({ kind: 'shipped', detail: expect.stringContaining(`work order ${name} shipped as ${mergeCommit}`) })],
			}),
			branchFolder: false,
		});
	});

	test("falls back to the local record labelled with the branch's own name when no local record saves the branch", async () => {
		const { guard, cwd } = await setupRenamedBranch();

		const refusal = await guard.authorize({ cwd, branch: name });

		// With no record here, the guard answers undefined; only the record
		// labelled `lo-140-multi`, holding no ship request, can refuse.
		expect(refusal).toEqual(expect.stringContaining(`lightsout work-order request-ship --name ${name}`));
	});
});
