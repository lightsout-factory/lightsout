import { readFileSync } from 'node:fs';
import { describe, expect, jest, test } from '@jest/globals';
import type { GateRunResult } from '#src/common/types/GateRunResult.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunLock } from '#src/contracts/run/RunLock.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { excludeWorkOrderPlan } from '#src/workOrder/excludeWorkOrderPlan/excludeWorkOrderPlan.ts';
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

const { name, firstPlan, secondPlan, checkout, headCommit, checkoutConfig, planOf } = planExclusionFixtures;

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
	test("records the verified commit when the ticket branch's checkout is clean and its full gates pass", async () => {
		const { base, recordPath } = await setupExclusion({
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Implemented }), planOf({ id: secondPlan, progress: PlanProgress.Implemented })],
		});

		const result = await excludeWorkOrderPlan({ ...base, plan: '2', reason: 'implementation removed with the agent', implementationRemoved: true });

		expect(result).not.toHaveProperty('error');
		// The same full run ship's integration makes: the checkout's own config,
		// coverage on and the whole repository included.
		expect(mockRunGates).toHaveBeenCalledWith(expect.objectContaining({ cwd: checkout, config: checkoutConfig, coverage: true, includeRoot: true }));
		const exclusion = exclusionAt({ recordPath, id: secondPlan });

		expect(typeof exclusion?.at).toBe('string');
		expect({ ...exclusion, at: undefined }).toStrictEqual({
			at: undefined,
			reason: 'implementation removed with the agent',
			implementationRemoved: true,
			verifiedCommit: headCommit,
		});
	});

	test("refuses the exclusion and changes nothing when the branch's gates fail", async () => {
		const { base, recordPath, before } = await setupExclusion({
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Implemented }), planOf({ id: secondPlan, progress: PlanProgress.Implemented })],
			gateError: 'test: 3 suites failed',
		});

		const result = await excludeWorkOrderPlan({ ...base, plan: '2', reason: 'implementation removed with the agent', implementationRemoved: true });

		// The gate's own output has to reach the human, or the refusal says the
		// branch is unverified without saying what was red.
		expect(errorOf({ result })).toContain('test: 3 suites failed');
		expect(readFileSync(recordPath, 'utf8')).toBe(before);
	});

	test("refuses a started plan's exclusion while the ticket branch's checkout has uncommitted changes", async () => {
		const { base, recordPath, before } = await setupExclusion({
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready }), planOf({ id: secondPlan, progress: PlanProgress.Implementing })],
			changed: ['src/workOrder/leftover.ts'],
		});

		const result = await excludeWorkOrderPlan({ ...base, plan: '2', reason: 'abandoned', implementationRemoved: true });

		expect(errorOf({ result })).toContain(checkout);
		expect(mockRunGates).not.toHaveBeenCalled();
		expect(readFileSync(recordPath, 'utf8')).toBe(before);
	});

	test("refuses a started plan's exclusion when no checkout holds the ticket branch", async () => {
		const { base, recordPath, before } = await setupExclusion({
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready }), planOf({ id: secondPlan, progress: PlanProgress.Failed })],
			worktree: undefined,
		});

		const result = await excludeWorkOrderPlan({ ...base, plan: '2', reason: 'replaced by plan 003', implementationRemoved: true });

		// the one sentence here genuinely about a git branch names the branch, prefix and all, rather than the work order's label
		expect(errorOf({ result })).toContain(`feature/${name}`);
		expect(mockRunGates).not.toHaveBeenCalled();
		expect(readFileSync(recordPath, 'utf8')).toBe(before);
	});

	test("refuses a started plan's exclusion while a live run holds the ticket branch's checkout", async () => {
		const { base, recordPath, before } = await setupExclusion({
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready }), planOf({ id: secondPlan, progress: PlanProgress.Implementing })],
			liveLock: { pid: 4242, runId: 'run-9c2a', startedAt: '2026-02-01T00:00:00.000Z' },
		});

		const result = await excludeWorkOrderPlan({ ...base, plan: '2', reason: 'abandoned', implementationRemoved: true });

		const error = errorOf({ result });

		// A gate run beside a live implementation run would verify a tree that is
		// still changing, so the recorded commit would prove nothing.
		expect(error).toContain('run-9c2a');
		expect(error).toContain(checkout);
		expect(mockRunGates).not.toHaveBeenCalled();
		expect(readFileSync(recordPath, 'utf8')).toBe(before);
	});

	test("refuses a started plan's exclusion when the checkout's git status or its commit cannot be read", async () => {
		const startedPlans = [planOf({ id: firstPlan, progress: PlanProgress.Ready }), planOf({ id: secondPlan, progress: PlanProgress.Implemented })];
		const noStatus = await setupExclusion({ plans: startedPlans, changed: undefined });
		// An unreadable HEAD only shows up after the clean check, so this row also
		// proves the verification stops before it records an exclusion with no commit.
		const noHead = await setupExclusion({ plans: startedPlans, head: undefined });

		const afterNoStatus = await excludeWorkOrderPlan({ ...noStatus.base, plan: '2', reason: 'code removed', implementationRemoved: true });
		const afterNoHead = await excludeWorkOrderPlan({ ...noHead.base, plan: '2', reason: 'code removed', implementationRemoved: true });

		expect(errorOf({ result: afterNoStatus })).toContain(checkout);
		expect(errorOf({ result: afterNoHead })).toContain(checkout);
		expect(exclusionAt({ recordPath: noStatus.recordPath, id: secondPlan })).toBeUndefined();
		expect(exclusionAt({ recordPath: noHead.recordPath, id: secondPlan })).toBeUndefined();
		expect(mockRunGates).not.toHaveBeenCalled();
	});
});
