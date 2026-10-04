import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/common/updateLocalWorkOrderState.ts';
import { setWorkOrderMode } from '#src/workOrder/setWorkOrderMode.ts';

/** The work order's label, which is also the branch the record names. */
const name = 'lo-191-hand-built';
const gates: LightsoutConfig['gates'] = { check: 'true', test: 'true', 'test-coverage': false };

/**
 * A checkout outside any repository, holding one single-plan work order with no
 * plan 001 that carries a person's authorization to ship hand-built work. No
 * `ticket-tracker` block is configured, so the record stays local and the file
 * the test reads back is exactly what the switch wrote.
 */
const setupAuthorizedHandBuilt = async ({
	handBuiltShipAuthorization = { by: 'Ada Lovelace ada@example.com', at: '2026-03-04T09:00:00.000Z' },
}: {
	/** The authorization the record starts with. */
	handBuiltShipAuthorization?: WorkOrderState['handBuiltShipAuthorization'];
} = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-mode-hand-built-'));
	const recordPath = join(cwd, '.lightsout', 'work-orders', name, 'state.json');
	const record: WorkOrderState = {
		schemaVersion: 1,
		name,
		ticketRef: 'LO-191',
		branch: name,
		mode: WorkOrderMode.SinglePlan,
		plans: [],
		handBuiltShipAuthorization,
		history: [],
	};

	await updateLocalWorkOrderState({ cwd, name, change: () => record });

	return {
		recordPath,
		params: { cwd, name, config: { gates, ship: { 'after-implement': false } } satisfies LightsoutConfig, env: {} },
	};
};

/** The record as it stands on disk, which is what every later command reads. */
const writtenRecordAt = ({ recordPath }: { recordPath: string }) => JSON.parse(readFileSync(recordPath, 'utf8')) as WorkOrderState;

describe('setWorkOrderMode', () => {
	test('withdraws a hand-built authorization when the work order switches to multiple-plan mode', async () => {
		const { params, recordPath } = await setupAuthorizedHandBuilt();

		const result = await setWorkOrderMode({ ...params, mode: WorkOrderMode.MultiplePlan, approve: false });

		const written = writtenRecordAt({ recordPath });

		expect({
			switched: 'error' in result ? result.error : result.record.mode,
			mode: written.mode,
			carriesAuthorization: Object.hasOwn(written, 'handBuiltShipAuthorization'),
			kinds: written.history.map((event) => event.kind),
		}).toStrictEqual({
			switched: 'multiple-plan',
			mode: 'multiple-plan',
			carriesAuthorization: false,
			kinds: ['hand-built-ship-authorization-withdrawn', 'mode-changed'],
		});
	});
});
