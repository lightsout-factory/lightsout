import { describe, expect, test } from '@jest/globals';
import { describeWorkOrderShipState } from '#src/cli/workOrder/workOrderCommand/workOrderShowCommand/describeWorkOrderShipState.ts';
import { WorkOrderShipStateKind } from '#src/common/constants/WorkOrderShipStateKind.ts';
import type { WorkOrderShipState } from '#src/common/types/WorkOrderShipState.ts';

const name = 'lo-140-multi';

/** A literal part is matched as written; a pattern pins human wording loosely. */
type LinePart = string | RegExp;

const carriesPart = ({ line, part }: { line: string; part: LinePart }) => (typeof part === 'string' ? line.includes(part) : part.test(line));

/** One state of every kind, each with the parts its line must carry so a reader can act on it. */
const everyShipState: { state: WorkOrderShipState; parts: LinePart[] }[] = [
	{ state: { kind: WorkOrderShipStateKind.Shipped, mergeCommit: '9f1c2d3' }, parts: ['9f1c2d3'] },
	{
		state: { kind: WorkOrderShipStateKind.ShipRequestMissing, includedPlanIds: ['001-search-basics', '002-fix-search'] },
		parts: [/no ship request/i],
	},
	{
		state: {
			kind: WorkOrderShipStateKind.ShipRequested,
			planIds: ['001-search-basics', '002-fix-search'],
			includedPlanIds: ['001-search-basics', '002-fix-search'],
			missingPlanIds: [],
			stalePlanIds: [],
			waitingPlanId: '002-fix-search',
		},
		parts: ['001-search-basics', '002-fix-search'],
	},
	{ state: { kind: WorkOrderShipStateKind.PlanOneWaiting, planId: '001-search-basics' }, parts: ['001-search-basics'] },
	{ state: { kind: WorkOrderShipStateKind.PlanOneImplemented, planId: '001-search-basics' }, parts: [/ready to ship/i] },
	{
		state: { kind: WorkOrderShipStateKind.PlanOneExcluded, planId: '001-search-basics', reason: 'covered by the upstream cache work' },
		parts: [/nothing to ship/i],
	},
	{ state: { kind: WorkOrderShipStateKind.TicketBodyUnbuilt }, parts: ['lightsout ship --hand-built'] },
	{ state: { kind: WorkOrderShipStateKind.TicketBodyBuilding, runId: 'run-20261001-building' }, parts: ['run-20261001-building'] },
	{
		state: { kind: WorkOrderShipStateKind.TicketBodyFailed, runId: 'run-20261001-failed' },
		parts: ['run-20261001-failed', 'lightsout ship --hand-built'],
	},
	{ state: { kind: WorkOrderShipStateKind.TicketBodyPassed, runId: 'run-20261001-passed' }, parts: [/ready to ship/i] },
	{
		state: { kind: WorkOrderShipStateKind.HandBuiltAuthorized, by: 'Dana Reyes dana@example.com', at: '2026-09-30T12:00:00.000Z' },
		parts: ['Dana Reyes dana@example.com', '2026-09-30T12:00:00.000Z'],
	},
];

const askAgain = ({ includedPlanIds }: { includedPlanIds: string[] }) =>
	`lightsout work-order request-ship --name ${name} --plans ${includedPlanIds.join(',')}`;

describe('describeWorkOrderShipState', () => {
	test.each(everyShipState)('words each ship state as the line work-order show prints for it', ({ state, parts }) => {
		const line = describeWorkOrderShipState({ name, state });

		expect({
			missingParts: parts.filter((part) => !carriesPart({ line, part })).map(String),
			saysUnfinished: /unfinished/i.test(line),
		}).toStrictEqual({ missingParts: [], saysUnfinished: false });
	});

	test.each(everyShipState.map(({ state }) => ({ state, staysOpen: state.kind === WorkOrderShipStateKind.ShipRequestMissing })))(
		'says a work order stays open only while a multiple-plan work order has no ship request',
		({ state, staysOpen }) => {
			const line = describeWorkOrderShipState({ name, state });

			expect(/stays open/i.test(line)).toBe(staysOpen);
		},
	);

	test.each([
		{
			drifted: true,
			planIds: ['001-search-basics'],
			includedPlanIds: ['001-search-basics', '002-fix-search'],
			missingPlanIds: ['002-fix-search'],
			stalePlanIds: [],
		},
		{
			drifted: true,
			planIds: ['001-search-basics', '003-drop-cache'],
			includedPlanIds: ['001-search-basics'],
			missingPlanIds: [],
			stalePlanIds: ['003-drop-cache'],
		},
		{
			drifted: false,
			planIds: ['001-search-basics', '002-fix-search'],
			includedPlanIds: ['001-search-basics', '002-fix-search'],
			missingPlanIds: [],
			stalePlanIds: [],
		},
	])(
		'words a drifted ship request as one to file again, naming the command, and a satisfied one as today',
		({ drifted, planIds, includedPlanIds, missingPlanIds, stalePlanIds }) => {
			const state: WorkOrderShipState = { kind: WorkOrderShipStateKind.ShipRequested, planIds, includedPlanIds, missingPlanIds, stalePlanIds };

			const line = describeWorkOrderShipState({ name, state });

			expect({
				namesRequestIds: planIds.every((id) => line.includes(id)),
				saysNoLongerNamesPlans: /no longer names the plans/i.test(line),
				carriesRequestShip: line.includes('lightsout work-order request-ship'),
				carriesAskAgain: line.includes(askAgain({ includedPlanIds })),
				saysShipsOnceEveryImplemented: /ships once every one of them is implemented/i.test(line),
			}).toStrictEqual({
				namesRequestIds: true,
				saysNoLongerNamesPlans: drifted,
				carriesRequestShip: drifted,
				carriesAskAgain: drifted,
				saysShipsOnceEveryImplemented: !drifted,
			});
		},
	);
});
