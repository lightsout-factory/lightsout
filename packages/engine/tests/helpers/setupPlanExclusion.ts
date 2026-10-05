import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { jest } from '@jest/globals';
import type { GateRunResult } from '#src/common/types/GateRunResult.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunLock } from '#src/contracts/run/RunLock.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/common/state/updateLocalWorkOrderState.ts';
import { planExclusionFixtures } from '#tests/helpers/planExclusionFixtures.ts';

interface GateParams {
	cwd: string;
	config: LightsoutConfig;
	coverage?: boolean;
	includeRoot?: boolean;
	onProgress?: (message: string) => void;
}

/**
 * The boundaries a branch verification runs through, which an exclusion test
 * doubles in its own `jest.mock` block and hands here so this fixture can
 * arrange what each one answers. The record itself stays a real file.
 */
interface PlanExclusionMocks {
	runGates: jest.Mock<(params: GateParams) => Promise<GateRunResult>>;
	readBranchWorktree: jest.Mock<(params: { cwd: string; branch: string }) => Promise<string | undefined>>;
	readLiveRunLock: jest.Mock<(params: { cwd: string }) => Promise<RunLock | undefined>>;
	readGitChangedFiles: jest.Mock<(params: { cwd: string }) => Promise<string[] | undefined>>;
	readGitHeadCommit: jest.Mock<(params: { cwd: string }) => Promise<string | undefined>>;
	readConfig: jest.Mock<(params: { cwd: string }) => Promise<LightsoutConfig>>;
}

interface Params {
	mocks: PlanExclusionMocks;
	mode?: WorkOrderMode;
	plans?: WorkOrderPlan[];
	/** A ship request already pending on the ticket. */
	shipRequest?: { planIds: string[]; requestedAt: string };
	/** The checkout holding the ticket branch, or undefined when none does. */
	worktree?: string;
	/** What that checkout has modified or untracked, or undefined when its git status cannot be read at all. */
	changed?: string[];
	/** The commit that checkout stands on, or undefined when it cannot be read. */
	head?: string;
	/** The run editing that checkout right now, or undefined when nothing is. */
	liveLock?: RunLock;
	/** The sentence the checkout's own gates fail with. */
	gateError?: string;
}

const { name, firstPlan, secondPlan, checkout, headCommit, checkoutConfig, planOf } = planExclusionFixtures;
const gates: LightsoutConfig['gates'] = { check: 'true', test: 'true', 'test-coverage': false };
/** No `ticket-tracker` block: this machine's record is the only copy, so no publish is in play. */
const config: LightsoutConfig = { gates };
const env: NodeJS.ProcessEnv = {};

const recordOf = ({
	mode,
	plans,
	shipRequest,
}: {
	mode: WorkOrderMode;
	plans: WorkOrderPlan[];
	shipRequest?: { planIds: string[]; requestedAt: string };
}): WorkOrderState => ({
	schemaVersion: 1,
	name,
	ticketRef: 'LO-140',
	// The branch carries a prefix the label does not, so every `--name` value and
	// every history detail can only read as the label it names.
	branch: `feature/${name}`,
	mode,
	plans,
	shipRequest,
	history: [{ at: '2026-01-01T00:00:00.000Z', kind: WorkOrderEventKind.PlanAdded, detail: `added plan ${firstPlan}` }],
});

/**
 * A temporary checkout holding the work order's record, with the ticket
 * branch's checkout, its git state, its live run and its gates scripted on the
 * mocks.
 */
export const setupPlanExclusion = async (setup: Params) => {
	const {
		mocks,
		mode = WorkOrderMode.MultiplePlan,
		plans = [planOf({ id: firstPlan, progress: PlanProgress.Ready }), planOf({ id: secondPlan, progress: PlanProgress.Planning })],
		shipRequest,
		liveLock,
		gateError,
	} = setup;
	// Read through the key rather than a destructuring default, so a row that
	// says `worktree: undefined` gets no checkout at all — a default would hand
	// it the checkout back and the row could never reach the refusal it names.
	const worktree = 'worktree' in setup ? setup.worktree : checkout;
	// The same reason for both of these: `undefined` is the unreadable answer
	// each of them has, and a default would swallow a row that asks for it.
	const changed = 'changed' in setup ? setup.changed : [];
	const head = 'head' in setup ? setup.head : headCommit;
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-exclude-plan-'));

	await updateLocalWorkOrderState({ cwd, name, change: () => recordOf({ mode, plans, shipRequest }) });

	mocks.readBranchWorktree.mockResolvedValue(worktree);
	mocks.readLiveRunLock.mockResolvedValue(liveLock);
	mocks.readGitChangedFiles.mockResolvedValue(changed);
	mocks.readGitHeadCommit.mockResolvedValue(head);
	mocks.readConfig.mockResolvedValue(checkoutConfig);
	mocks.runGates.mockResolvedValue({
		error: gateError,
		failedFamilies: gateError === undefined ? [] : ['test'],
		crashes: [],
		timeouts: [],
		coordination: undefined,
	});

	const recordPath = join(cwd, '.lightsout', 'work-orders', name, 'state.json');

	return { recordPath, before: readFileSync(recordPath, 'utf8'), base: { cwd, name, config, env } };
};
