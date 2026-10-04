import { describe, expect, test } from '@jest/globals';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { recordHandBuiltShipAuthorizationWithdrawal } from '#src/workOrder/common/recordHandBuiltShipAuthorizationWithdrawal.ts';

const setupRecord = ({ authorization }: { authorization?: { by: string; at: string } } = {}): { record: WorkOrderState } => ({
	record: {
		schemaVersion: 1,
		name: 'lo-191-ship',
		branch: 'lo-191-ship',
		mode: WorkOrderMode.SinglePlan,
		plans: [],
		...(authorization === undefined ? {} : { handBuiltShipAuthorization: authorization }),
		history: [{ at: '2026-09-30T10:00:00.000Z', kind: WorkOrderEventKind.ModeChanged, detail: 'work order lo-191-ship moved to single-plan mode' }],
	},
});

describe('recordHandBuiltShipAuthorizationWithdrawal', () => {
	test('takes a recorded authorization off the record and appends one withdrawn event with the detail and time it is handed', () => {
		const { record } = setupRecord({ authorization: { by: 'Ada Lovelace ada@example.com', at: '2026-09-30T11:00:00.000Z' } });

		const withdrawn = recordHandBuiltShipAuthorizationWithdrawal({
			record,
			detail: 'plan 001 was added, so the hand-built authorization no longer covers the ticket',
			at: '2026-09-30T12:00:00.000Z',
		});

		const { handBuiltShipAuthorization, ...rest } = withdrawn;

		expect({ handBuiltShipAuthorization, rest }).toStrictEqual({
			handBuiltShipAuthorization: undefined,
			rest: {
				schemaVersion: 1,
				name: 'lo-191-ship',
				branch: 'lo-191-ship',
				mode: 'single-plan',
				plans: [],
				history: [
					{ at: '2026-09-30T10:00:00.000Z', kind: 'mode-changed', detail: 'work order lo-191-ship moved to single-plan mode' },
					{
						at: '2026-09-30T12:00:00.000Z',
						kind: 'hand-built-ship-authorization-withdrawn',
						detail: 'plan 001 was added, so the hand-built authorization no longer covers the ticket',
					},
				],
			},
		});
	});

	test('returns a record carrying no authorization as the same object', () => {
		const { record } = setupRecord();

		const withdrawn = recordHandBuiltShipAuthorizationWithdrawal({
			record,
			detail: 'a build from the ticket body started under run run-1, so the hand-built authorization no longer stands',
			at: '2026-09-30T12:00:00.000Z',
		});

		expect(withdrawn).toBe(record);
	});
});
