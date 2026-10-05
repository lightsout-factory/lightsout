import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { copyRunInputs } from '#src/cli/common/implementRun/copyRunInputs.ts';
import { resolveRunWorkspace } from '#src/cli/common/implementRun/resolveRunWorkspace/resolveRunWorkspace.ts';
import type { RunWorkspace } from '#src/cli/common/types/RunWorkspace.ts';
import { resolvePlanTarget } from '#src/cli/implementCommand/common/resolvePlanTarget.ts';
import type { PlanTarget } from '#src/cli/implementCommand/common/types/PlanTarget.ts';
import { describeUncommittableTree } from '#src/commit/describeUncommittableTree.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

interface Params {
	/** The checkout the command was launched from. */
	cwd: string;
	config: LightsoutConfig;
	flags: CommandContext['flags'];
	/** `--plan` exactly as the user typed it. */
	planPath: string;
}

/**
 * The plan target is resolved a second time here on purpose: the caller's call
 * answered what the user pointed at, this one answers where that input now
 * lives in the workspace.
 */
export const openImplementWorkspace = async ({
	cwd,
	config,
	flags,
	planPath,
}: Params): Promise<{ workspace: RunWorkspace; target: PlanTarget } | { error: string }> => {
	const workspace = await resolveRunWorkspace({ cwd, config, flags, planPath, onProgress: createProgressPrinter() });

	if ('error' in workspace) {
		return { error: workspace.error };
	}

	// Before the input copy, so the guard judges the tree the run will commit
	// rather than a tree the copy has already touched.
	// Empty: a fresh run commits with `keepGenerated` false, so its commit discards changed generated paths — exempting them would start it over a person's uncommitted build output and then delete it.
	const uncommittable = await describeUncommittableTree({ cwd: workspace.cwd, isolated: workspace.isolated, generated: [] });

	if (uncommittable !== undefined) {
		return { error: uncommittable };
	}

	// A run building where it was launched has moved nowhere, and
	// `printRunHeader` already names that checkout on its `cwd:` line.
	if (workspace.isolated) {
		console.log(`lightsout: workspace ${workspace.cwd}\n  branch: ${workspace.branch}`);
	}

	const copied = await copyRunInputs({ sourceCwd: cwd, workspace: workspace.cwd, planPath });

	if ('error' in copied) {
		return { error: copied.error };
	}

	const target = await resolvePlanTarget({ cwd: workspace.cwd, planPath: copied.planPath ?? planPath });

	return 'error' in target ? { error: target.error } : { workspace, target };
};
