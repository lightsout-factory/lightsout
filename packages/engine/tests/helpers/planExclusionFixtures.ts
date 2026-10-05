import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';

/**
 * The work order a plan exclusion acts on, as one vocabulary the setup and the
 * cases built on it read from — so two files cannot disagree about which
 * checkout holds the branch or which commit it stands on.
 */
export const planExclusionFixtures: {
	name: string;
	firstPlan: string;
	secondPlan: string;
	checkout: string;
	headCommit: string;
	checkoutConfig: LightsoutConfig;
	planOf: (params: { id: string; progress: PlanProgress; exclusion?: WorkOrderPlan['exclusion'] }) => WorkOrderPlan;
} = {
	/** The work order's label: the folder every record sits in, and the name every remedy takes. */
	name: 'lo-140-multi',
	firstPlan: '001-record',
	secondPlan: '002-queue-order',
	/** The checkout that holds the ticket branch, which every refusal about the branch names. */
	checkout: '/repo/.worktrees/lo-140-multi',
	headCommit: '9f1c0a7d3b6e4152a8c07d5b9e2f4a6c1d3e5f70',
	/** The ticket branch's OWN config, which the verification reads from that checkout rather than from `cwd`. */
	checkoutConfig: { gates: { check: 'pnpm check', test: 'pnpm test', 'test-coverage': 'pnpm coverage' } },
	planOf: ({ id, progress, exclusion }) => ({
		id,
		title: `plan ${id}`,
		progress,
		createdAt: '2026-01-01T00:00:00.000Z',
		exclusion,
	}),
};
