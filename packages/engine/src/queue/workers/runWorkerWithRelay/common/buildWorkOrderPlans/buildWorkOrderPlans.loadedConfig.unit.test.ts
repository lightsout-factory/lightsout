import { describe, expect, jest, test } from '@jest/globals';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import { buildWorkOrderPlans } from '#src/queue/workers/runWorkerWithRelay/common/buildWorkOrderPlans/buildWorkOrderPlans.ts';
import { config, planOf, setupTicketPlanBuild } from '#tests/helpers/setupTicketPlanBuild.ts';

/**
 * Which config each build a work order's loop starts is handed to record: the
 * queue's loaded config, whether the build is a ready plan's or one made from
 * the ticket body. The loop's ordering and outcomes are the sibling files'.
 */

// Mocked Imports
// -------------------------
// Both implement pipelines spawn a harness against a real repository, and each
// is covered by its own tests. Stubbing the pair leaves the plan folder build,
// the ticket lifecycle and the record on disk real, so what a ready plan's
// build is handed is what `runPlanFolderPipeline` passed on.
const mockRunPhasesPipeline = jest.fn<(params: { overviewPath: string }) => Promise<PipelineResult>>();

jest.mock('#src/phases/runPhasesPipeline/runPhasesPipeline.ts', () => ({
	runPhasesPipeline: (params: { overviewPath: string }) => mockRunPhasesPipeline(params),
}));
// -------------------------
const mockRunImplementPipeline = jest.fn<(params: PlanBuildCall) => Promise<PipelineResult>>();

jest.mock('#src/pipeline/runImplementPipeline/runImplementPipeline.ts', () => ({
	runImplementPipeline: (params: PlanBuildCall) => mockRunImplementPipeline(params),
}));
// -------------------------
const mockRunDirectWork = jest.fn<(params: DirectCall) => Promise<PipelineResult>>();

jest.mock('#src/direct/runDirectWork/runDirectWork.ts', () => ({ runDirectWork: (params: DirectCall) => mockRunDirectWork(params) }));
// -------------------------
const mockCommitTicketWork =
	jest.fn<
		(params: {
			cwd: string;
			composeMessage: ({ cwd }: { cwd: string }) => Promise<string>;
			runDir: string;
		}) => Promise<{ committed: false } | { committed: true; message: string } | QueueFailure>
	>();

jest.mock('#src/commit/commitWorkOrderWork/commitWorkOrderWork.ts', () => ({
	commitWorkOrderWork: (params: { cwd: string; composeMessage: ({ cwd }: { cwd: string }) => Promise<string>; runDir: string }) => mockCommitTicketWork(params),
}));
// -------------------------
const mockReadGitChangedFiles = jest.fn<(params: { cwd: string }) => Promise<string[] | undefined>>();

jest.mock('#src/common/git/readGitChangedFiles.ts', () => ({
	readGitChangedFiles: (params: { cwd: string }) => mockReadGitChangedFiles(params),
}));
// -------------------------
const mockRestoreTicketPlan = jest.fn<(params: { cwd: string; address: string }) => Promise<{ restored: string[] } | { error: string }>>();

jest.mock('#src/workOrder/restoreWorkOrderPlan.ts', () => ({
	restoreWorkOrderPlan: (params: { cwd: string; address: string }) => mockRestoreTicketPlan(params),
}));
// -------------------------

/** What a build of one plan was handed — its plan path, and the loaded config it records. */
interface PlanBuildCall {
	planPath: string;
	loadedConfig?: LoadedConfig;
}

/** What a build of the ticket body was handed, restated here because a `jest.mock` factory may not reach outside the file. */
interface DirectCall {
	cwd: string;
	ticketBody: string;
	ticketRef: string;
	runId?: string;
	driverName: string;
	config: LightsoutConfig;
	loadedConfig?: LoadedConfig;
}

/** The stubs the shared fixture arranges, gathered once. */
const mocks = {
	runImplementPipeline: mockRunImplementPipeline,
	runPhasesPipeline: mockRunPhasesPipeline,
	runDirectWork: mockRunDirectWork,
	commitWorkOrderWork: mockCommitTicketWork,
	readGitChangedFiles: mockReadGitChangedFiles,
	restoreWorkOrderPlan: mockRestoreTicketPlan,
};

const firstImplemented = planOf({
	id: '001-search-index',
	title: 'Search index',
	progress: PlanProgress.Implemented,
	runId: 'run-1',
	finishedAt: '2026-01-03T00:00:00.000Z',
});
const secondReady = planOf({ id: '002-search-basics', title: 'Search basics', progress: PlanProgress.Ready });

/**
 * A work order whose loop takes one build: a multiple-plan work order with one
 * ready plan left, or a single-plan work order holding no plan, which is built
 * from the ticket body. The loaded config carries a harness the stamped config
 * does not, so a build handed the stamped one in its place reads apart.
 */
const setupLoadedConfigBuild = ({ build }: { build: 'ready plan' | 'ticket body' }) => {
	const { params } =
		build === 'ready plan'
			? setupTicketPlanBuild({ mocks, plans: [firstImplemented, secondReady] })
			: setupTicketPlanBuild({ mocks, plans: [], mode: WorkOrderMode.SinglePlan });
	const loadedConfig: LoadedConfig = {
		config: { ...config, harness: 'codex' },
		path: '/launching/checkout/lightsout.config.json',
	};

	return { params: { ...params, loadedConfig, allowTicketBodyBuild: build === 'ticket body' }, loadedConfig };
};

describe('buildWorkOrderPlans', () => {
	test.each([
		{ build: 'ready plan' as const, ran: 'plan' },
		{ build: 'ticket body' as const, ran: 'direct' },
	])("a ready plan and a ticket-body build both run with the queue's loaded config", async ({ build, ran }) => {
		const { params, loadedConfig } = setupLoadedConfigBuild({ build });

		await buildWorkOrderPlans(params);

		const handed = {
			plan: mockRunImplementPipeline.mock.calls.map(([call]) => call.loadedConfig),
			direct: mockRunDirectWork.mock.calls.map(([call]) => call.loadedConfig),
		};

		// the one build the work order calls for records the queue's config as
		// read and its path, never the stamped config the loop also carries
		expect(handed).toStrictEqual({
			plan: ran === 'plan' ? [loadedConfig] : [],
			direct: ran === 'direct' ? [loadedConfig] : [],
		});
	});
});
