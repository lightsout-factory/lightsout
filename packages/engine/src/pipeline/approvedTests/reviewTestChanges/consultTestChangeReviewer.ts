import { buildTestChangeReviewInvocation } from '#src/agents/buildTestChangeReviewInvocation.ts';
import { defaultSupervisorTimeoutMinutes } from '#src/common/constants/defaultSupervisorTimeoutMinutes.ts';
import type { ActivityLevel } from '#src/common/types/ActivityLevel.ts';
import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { Permissions } from '#src/contracts/Permissions.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import { TestChangeReview } from '#src/contracts/work/TestChangeReview.ts';
import { invokeAgentWithContract } from '#src/invoke/invokeAgentWithContract/invokeAgentWithContract.ts';
import type { TestChange } from '#src/pipeline/approvedTests/reviewTestChanges/common/types/TestChange.ts';

const reviewerPermissions = Permissions.ReadOnly;

interface Params {
	driver: Driver;
	cwd: string;
	config: LightsoutConfig;
	planContent: string;
	overviewContent?: string;
	checkpoint: string;
	/** The live acceptance-test mapping the reviewer must account for. */
	acceptanceTests: AcceptanceTestRecord[];
	/** Source files the run has changed so far. */
	changedFiles: string[];
	/** The checkpoint's change bundle — one entry per test-side file that differs from its approved version. */
	changes: TestChange[];
	onEvent?: (event: unknown) => void;
	onRejectedOutput?: (params: { text: string; attempt: number; validationError: string }) => Promise<void> | void;
	/** The level this review's harness processes are recorded under. Absent wherever no run is being recorded. */
	activity?: ActivityLevel;
}

/**
 * Read-only whatever the consumer's config grants, and on the supervisor's
 * timeout rather than the agent one, because it reads and rules rather than
 * building.
 *
 * Lives here rather than beside `consultSupervisor` because its params carry
 * this module's private bundle entry type.
 */
export const consultTestChangeReviewer = async ({
	driver,
	cwd,
	config,
	planContent,
	overviewContent,
	checkpoint,
	acceptanceTests,
	changedFiles,
	changes,
	onEvent,
	onRejectedOutput,
	activity,
}: Params): Promise<AgentOutcome<TestChangeReview>> => {
	return invokeAgentWithContract({
		driver,
		cwd,
		invocation: buildTestChangeReviewInvocation({ planContent, overviewContent, checkpoint, acceptanceTests, changedFiles, changes }),
		contract: TestChangeReview,
		model: config.model,
		effort: config.effort,
		permissions: reviewerPermissions,
		timeoutMs: (config.timeouts?.['supervisor-minutes'] ?? defaultSupervisorTimeoutMinutes) * 60_000,
		onEvent,
		onRejectedOutput,
		activity,
	});
};
