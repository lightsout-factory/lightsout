import { readFileSync } from 'node:fs';
import { describe, expect, jest, test } from '@jest/globals';
import type { GateRunResult } from '#src/common/types/GateRunResult.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunLock } from '#src/contracts/run/RunLock.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { excludeWorkOrderPlan } from '#src/workOrder/excludeWorkOrderPlan/excludeWorkOrderPlan.ts';
import { setWorkOrderMode } from '#src/workOrder/setWorkOrderMode.ts';
import { planExclusionFixtures } from '#tests/helpers/planExclusionFixtures.ts';
import { setupPlanExclusion } from '#tests/helpers/setupPlanExclusion.ts';

// Mocked Imports
// -------------------------
// The four boundaries a branch verification runs through — which checkout holds
// the branch, what it has uncommitted, which run is editing it, and what its own
// gates say — are the seams. Mocking them is what lets 'no gate ran at all' and
// 'this exact commit was the verified one' be asserted. The record itself is a
// real file in a temporary checkout, because what this function promises is
// about which bytes reach disk.
interface GateParams {
	cwd: string;
	config: LightsoutConfig;
	coverage?: boolean;
	includeRoot?: boolean;
	onProgress?: (message: string) => void;
}

const mockRunGates = jest.fn<(params: GateParams) => Promise<GateRunResult>>();

jest.mock('#src/gates/runGates/runGates.ts', () => ({ runGates: (params: GateParams) => mockRunGates(params) }));
// -------------------------
const mockReadBranchWorktree = jest.fn<(params: { cwd: string; branch: string }) => Promise<string | undefined>>();

jest.mock('#src/worktree/readBranchWorktree.ts', () => ({
	readBranchWorktree: (params: { cwd: string; branch: string }) => mockReadBranchWorktree(params),
}));
// -------------------------
const mockReadLiveRunLock = jest.fn<(params: { cwd: string }) => Promise<RunLock | undefined>>();

jest.mock('#src/runState/lock/readLiveRunLock.ts', () => ({ readLiveRunLock: (params: { cwd: string }) => mockReadLiveRunLock(params) }));
// -------------------------
const mockReadGitChangedFiles = jest.fn<(params: { cwd: string }) => Promise<string[] | undefined>>();

jest.mock('#src/common/git/readGitChangedFiles.ts', () => ({ readGitChangedFiles: (params: { cwd: string }) => mockReadGitChangedFiles(params) }));
// -------------------------
const mockReadGitHeadCommit = jest.fn<(params: { cwd: string }) => Promise<string | undefined>>();

jest.mock('#src/common/git/readGitHeadCommit.ts', () => ({ readGitHeadCommit: (params: { cwd: string }) => mockReadGitHeadCommit(params) }));
// -------------------------
const mockReadConfig = jest.fn<(params: { cwd: string }) => Promise<LightsoutConfig>>();

jest.mock('#src/common/config/readConfig.ts', () => ({ readConfig: (params: { cwd: string }) => mockReadConfig(params) }));
// -------------------------

const { name, firstPlan, secondPlan, headCommit, planOf } = planExclusionFixtures;

/** The arrangement `setupPlanExclusion` makes, scripted on this file's mocks. */
const setupExclusion = (setup: Omit<Parameters<typeof setupPlanExclusion>[0], 'mocks'> = {}) =>
	setupPlanExclusion({
		mocks: {
			runGates: mockRunGates,
			readBranchWorktree: mockReadBranchWorktree,
			readLiveRunLock: mockReadLiveRunLock,
			readGitChangedFiles: mockReadGitChangedFiles,
			readGitHeadCommit: mockReadGitHeadCommit,
			readConfig: mockReadConfig,
		},
		...setup,
	});

const recordAt = ({ recordPath }: { recordPath: string }): WorkOrderState => JSON.parse(readFileSync(recordPath, 'utf8'));

const exclusionAt = ({ recordPath, id }: { recordPath: string; id: string }) => recordAt({ recordPath }).plans.find((plan) => plan.id === id)?.exclusion;

/** The refusal sentence, or an empty string when the call did not refuse — so a missing refusal fails the assertion rather than the type check. */
const errorOf = ({ result }: { result: { error: string } | { record: WorkOrderState } }) => ('error' in result ? result.error : '');

describe('excludeWorkOrderPlan', () => {
	test('excludes a plan whose implementation never started without verifying the branch', async () => {
		const { base, recordPath } = await setupExclusion();

		const result = await excludeWorkOrderPlan({ ...base, plan: '2', reason: 'superseded by plan 003', implementationRemoved: false });

		expect(result).not.toHaveProperty('error');
		const exclusion = exclusionAt({ recordPath, id: secondPlan });

		expect(typeof exclusion?.at).toBe('string');
		// The rest is compared whole, so a `verifiedCommit` recorded for a plan
		// nothing was verified about fails here rather than passing as an extra key.
		expect({ ...exclusion, at: undefined }).toStrictEqual({
			at: undefined,
			reason: 'superseded by plan 003',
			implementationRemoved: false,
		});
		expect(mockRunGates).not.toHaveBeenCalled();
	});

	test('withdraws a pending ship request that names the excluded plan', async () => {
		const { base, recordPath } = await setupExclusion({ shipRequest: { planIds: [firstPlan, secondPlan], requestedAt: '2026-02-01T00:00:00.000Z' } });

		const result = await excludeWorkOrderPlan({ ...base, plan: secondPlan, reason: 'not needed after all', implementationRemoved: false });

		const record = recordAt({ recordPath });

		expect(result).toEqual(expect.objectContaining({ notice: expect.stringContaining('ship request') }));
		expect(record.shipRequest).toBeUndefined();
		// The exclusion is recorded first and the withdrawal it caused second, so
		// the history reads as one following from the other.
		expect(record.history.slice(-2)).toEqual([
			// the exclusion is recorded against the work order's label, never
			// against the prefixed branch its plans implement on
			expect.objectContaining({ kind: WorkOrderEventKind.PlanExcluded, detail: expect.stringContaining(`excluded from work order ${name}:`) }),
			expect.objectContaining({ kind: WorkOrderEventKind.ShipRequestWithdrawn, detail: expect.stringContaining(secondPlan) }),
		]);
		expect(record.history.at(-1)?.detail).toContain('not needed after all');
	});

	test('refuses to exclude a plan that is already excluded', async () => {
		const pendingRemoval: WorkOrderPlan['exclusion'] = { at: '2026-01-05T00:00:00.000Z', reason: 'the first reason', implementationRemoved: false };
		const recordedRemoval: WorkOrderPlan['exclusion'] = {
			at: '2026-01-05T00:00:00.000Z',
			reason: 'the first reason',
			implementationRemoved: true,
			verifiedCommit: 'c0ffee1234567890c0ffee1234567890c0ffee12',
		};

		// The only two calls an existing exclusion can take: a plain second
		// exclusion, and a removal on one that already records a removal.
		for (const { exclusion, implementationRemoved, progress } of [
			{ exclusion: pendingRemoval, implementationRemoved: false, progress: PlanProgress.Planning },
			{ exclusion: recordedRemoval, implementationRemoved: true, progress: PlanProgress.Implemented },
		]) {
			const { base, recordPath, before } = await setupExclusion({
				plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready }), planOf({ id: secondPlan, progress, exclusion })],
			});

			const result = await excludeWorkOrderPlan({ ...base, plan: '2', reason: 'a second reason', implementationRemoved });

			expect(errorOf({ result })).toContain(`already excluded from work order ${name}`);
			expect(exclusionAt({ recordPath, id: secondPlan })).toStrictEqual(exclusion);
			expect(readFileSync(recordPath, 'utf8')).toBe(before);
		}
	});

	test('records a verified removal on an existing exclusion so the ticket can return to single-plan mode', async () => {
		const original: WorkOrderPlan['exclusion'] = { at: '2026-01-05T00:00:00.000Z', reason: 'superseded, code removed by hand', implementationRemoved: false };
		const { base, recordPath } = await setupExclusion({
			plans: [
				planOf({ id: firstPlan, progress: PlanProgress.Implemented }),
				planOf({ id: secondPlan, progress: PlanProgress.Implemented, exclusion: original }),
			],
		});

		const result = await excludeWorkOrderPlan({ ...base, plan: '2', reason: 'a reason the record keeps out', implementationRemoved: true });

		// The second call is the point of the first: recording the verified removal
		// is what reopens the way back to single-plan mode.
		const switched = await setWorkOrderMode({ ...base, mode: WorkOrderMode.SinglePlan, approve: false });

		expect(result).not.toHaveProperty('error');
		expect(exclusionAt({ recordPath, id: secondPlan })).toStrictEqual({
			at: '2026-01-05T00:00:00.000Z',
			reason: 'superseded, code removed by hand',
			implementationRemoved: true,
			verifiedCommit: headCommit,
		});
		expect(recordAt({ recordPath }).history.filter((event) => event.kind === WorkOrderEventKind.PlanExcluded)).toHaveLength(1);
		// the removal is recorded against the label too, beside the commit that verified it
		expect(recordAt({ recordPath }).history.find((event) => event.kind === WorkOrderEventKind.PlanExcluded)?.detail).toContain(
			`removed from work order ${name}, verified at ${headCommit}`,
		);
		expect(switched).not.toHaveProperty('error');
		expect(recordAt({ recordPath }).mode).toBe(WorkOrderMode.SinglePlan);
	});

	test('refuses to exclude plan 001 in single-plan mode', async () => {
		const { base, recordPath, before } = await setupExclusion({
			mode: WorkOrderMode.SinglePlan,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
		});

		const result = await excludeWorkOrderPlan({ ...base, plan: '1', reason: 'no longer wanted', implementationRemoved: false });

		expect(result).toHaveProperty('error');
		expect(readFileSync(recordPath, 'utf8')).toBe(before);
	});

	test('refuses --implementation-removed for a plan whose implementation never started', async () => {
		const { base, recordPath, before } = await setupExclusion();

		const result = await excludeWorkOrderPlan({ ...base, plan: '2', reason: 'never built', implementationRemoved: true });

		expect(errorOf({ result })).toContain(`on work order ${name} has no implementation to remove`);
		expect(mockRunGates).not.toHaveBeenCalled();
		expect(readFileSync(recordPath, 'utf8')).toBe(before);
	});

	test('excludeWorkOrderPlan refusals and notices spell the work-order command word', async () => {
		const singlePlan = await setupExclusion({ mode: WorkOrderMode.SinglePlan, plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })] });
		// A started plan, so the withdrawal rides on the verified-removal path the
		// criterion names rather than on the plain exclusion the row above covers.
		const started = await setupExclusion({
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Implemented }), planOf({ id: secondPlan, progress: PlanProgress.Implemented })],
			shipRequest: { planIds: [firstPlan, secondPlan], requestedAt: '2026-02-01T00:00:00.000Z' },
		});

		const refused = await excludeWorkOrderPlan({ ...singlePlan.base, plan: '1', reason: 'no longer wanted', implementationRemoved: false });
		const withdrawn = await excludeWorkOrderPlan({ ...started.base, plan: '2', reason: 'implementation removed with the agent', implementationRemoved: true });

		const refusal = errorOf({ result: refused });
		const notice = 'error' in withdrawn ? undefined : withdrawn.notice;

		expect(refusal).toContain(`lightsout work-order mode --name ${name} --set multiple-plan`);
		expect(notice).toContain(`lightsout work-order request-ship --name ${name}`);
		// `--name` takes the label, so a remedy naming the prefixed branch is one nothing accepts
		expect(`${refusal}\n${notice ?? ''}`).not.toContain('feature/');
		// The old command word anywhere in either sentence is the failure this row
		// exists for, so both are checked for it rather than only for the new one.
		expect(refusal).not.toContain('lightsout ticket ');
		expect(notice).not.toContain('lightsout ticket ');
	});
});
