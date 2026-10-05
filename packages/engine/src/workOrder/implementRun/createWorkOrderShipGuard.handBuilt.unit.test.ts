import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/common/state/updateLocalWorkOrderState.ts';
import { createWorkOrderShipGuard } from '#src/workOrder/implementRun/createWorkOrderShipGuard.ts';

/** The work order's label, which is also the branch its record saves. */
const name = 'lo-140-multi';
const gates: LightsoutConfig['gates'] = { check: 'true', test: 'true', 'test-coverage': false };
/** No `ticket-tracker` block, so the record is local only and the guard never reaches for a tracker. */
const localConfig: LightsoutConfig = { gates };
const mergeCommit = 'a1b2c3d4e5f6';
const authorizedBy = 'Ada Lovelace ada@example.com';
const authorizedAt = '2026-01-05T00:00:00.000Z';
const firstEvent = { at: '2026-01-01T00:00:00.000Z', kind: WorkOrderEventKind.ModeChanged, detail: 'work order created in single-plan mode' };

/**
 * A single-plan work order holding no plan 001, in a checkout outside any
 * repository, carrying whichever build from the ticket body and hand-built
 * authorization the row names, and the guard built over it.
 */
const setupHandBuiltGuard = async ({
	build,
	authorized = false,
}: {
	/** The progress of the record's latest build from the ticket body. No build when absent. */
	build?: typeof PlanProgress.Implemented | typeof PlanProgress.Failed;
	/** Whether the record carries a person's hand-built authorization. */
	authorized?: boolean;
} = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-ship-guard-hand-built-'));
	const recordPath = join(cwd, '.lightsout', 'work-orders', name, 'state.json');
	const record: WorkOrderState = {
		schemaVersion: 1,
		name,
		ticketRef: 'LO-140',
		branch: name,
		mode: WorkOrderMode.SinglePlan,
		plans: [],
		...(build === undefined
			? {}
			: {
					ticketBodyBuild: {
						runId: 'run-body-1',
						progress: build,
						startedAt: '2026-01-04T00:00:00.000Z',
						finishedAt: '2026-01-04T01:00:00.000Z',
					},
				}),
		...(authorized ? { handBuiltShipAuthorization: { by: authorizedBy, at: authorizedAt } } : {}),
		history: [firstEvent],
	};
	const seeded = await updateLocalWorkOrderState({ cwd, name, change: () => record });

	if ('error' in seeded) {
		throw new Error(seeded.error);
	}

	return {
		cwd,
		recordPath,
		before: readFileSync(recordPath, 'utf8'),
		branch: name,
		guard: createWorkOrderShipGuard({ config: localConfig, env: {} }),
	};
};

/** The detail of the last event the record on disk holds. */
const readLastDetailAt = ({ recordPath }: { recordPath: string }) => {
	const stored = JSON.parse(readFileSync(recordPath, 'utf8')) as WorkOrderState;
	const last = stored.history.at(-1);

	return { kind: last?.kind, detail: last?.detail ?? '' };
};

describe('createWorkOrderShipGuard', () => {
	test('authorizes a single-plan work order holding no plan 001 that carries a hand-built authorization, without writing to its record', async () => {
		const { guard, cwd, branch, recordPath, before } = await setupHandBuiltGuard({ build: PlanProgress.Failed, authorized: true });

		const refusal = await guard.authorize({ cwd, branch });

		expect({ refusal, bytes: readFileSync(recordPath, 'utf8') }).toStrictEqual({ refusal: undefined, bytes: before });
	});

	test('refuses a single-plan work order holding no plan 001 with a failed build and no authorization, naming lightsout ship --hand-built and writing no authorization', async () => {
		const { guard, cwd, branch, recordPath, before } = await setupHandBuiltGuard({ build: PlanProgress.Failed });

		const refusal = await guard.authorize({ cwd, branch });

		expect({ refusal, bytes: readFileSync(recordPath, 'utf8') }).toEqual({
			refusal: expect.stringContaining('lightsout ship --hand-built'),
			bytes: before,
		});
	});

	test('records a hand-built ship as hand-built work authorized by the person the record names', async () => {
		const { guard, cwd, branch, recordPath } = await setupHandBuiltGuard({ build: PlanProgress.Failed, authorized: true });

		await guard.recordShipped({ cwd, branch, mergeCommit });

		const { kind, detail } = readLastDetailAt({ recordPath });

		expect({ kind, detail }).toEqual({
			kind: 'shipped',
			detail: expect.stringMatching(new RegExp(`${name}.*${mergeCommit}.*hand-built.*${authorizedBy}`)),
		});
		expect(detail).not.toMatch(/ticket body/);
	});

	test('records a ship whose build from the ticket body passed as shipped from the ticket body even when an authorization is also recorded', async () => {
		const { guard, cwd, branch, recordPath } = await setupHandBuiltGuard({ build: PlanProgress.Implemented, authorized: true });

		await guard.recordShipped({ cwd, branch, mergeCommit });

		const { kind, detail } = readLastDetailAt({ recordPath });

		expect({ kind, detail }).toEqual({ kind: 'shipped', detail: expect.stringContaining('from the ticket body') });
		expect(detail).not.toMatch(/hand-built/);
	});

	test('records a plan-less ship with neither a passed build nor an authorization without attributing it', async () => {
		const { guard, cwd, branch, recordPath } = await setupHandBuiltGuard({ build: PlanProgress.Failed });

		await guard.recordShipped({ cwd, branch, mergeCommit });

		const lastEvent = readLastDetailAt({ recordPath });

		expect(lastEvent).toStrictEqual({ kind: 'shipped', detail: `work order ${name} shipped as ${mergeCommit}` });
	});
});
