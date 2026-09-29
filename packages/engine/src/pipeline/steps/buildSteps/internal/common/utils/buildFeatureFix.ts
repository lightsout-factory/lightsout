import { buildFeatureExecutorInvocation } from '#src/agents/buildFeatureExecutorInvocation.ts';
import type { RenameRule } from '#src/contracts/plan/renames/RenameRule.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { FixBuilder } from '#src/pipeline/internal/steps/common/types/FixBuilder.ts';

interface Params {
	run: PipelineRun;
	planContent: string;
	overviewContent?: string;
	standards?: string;
	fileLimit: number | undefined;
	/** Read at every call rather than captured once. */
	acceptanceTests: () => AcceptanceTestRecord[];
	renames: RenameRule[];
	selfCheckCommand: string;
}

/**
 * A rename-only plan's verify-tests also repairs through this, because a unit-test writer
 * must not repair a phase that writes no tests. It must receive the same `selfCheckCommand`
 * and `renames` as the implement spawn, or the role's cached system prompt splits in two.
 */
export const buildFeatureFix =
	({ run, planContent, overviewContent, standards, fileLimit, acceptanceTests, renames, selfCheckCommand }: Params): FixBuilder =>
	({ errorContext }) =>
		buildFeatureExecutorInvocation({
			planContent,
			overviewContent,
			standards,
			errorContext,
			changedFiles: run.current().changedFiles,
			allowedCommands: run.config['agent-commands'],
			fileLimit,
			acceptanceTests: acceptanceTests(),
			selfCheckCommand,
			renames,
		});
