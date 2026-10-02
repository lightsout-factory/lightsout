import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { copyRunInputs } from '#src/cli/internal/common/implementRun/copyRunInputs.ts';
import { resolveRunWorkspace } from '#src/cli/internal/common/implementRun/resolveRunWorkspace.ts';
import type { RunWorkspace } from '#src/cli/internal/common/types/RunWorkspace.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import { describeUncommittableTree } from '#src/commit/describeUncommittableTree.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';

interface Params {
	/** The checkout the command was launched from. */
	cwd: string;
	config: LightsoutConfig;
	flags: CommandContext['flags'];
	/** `--ticket` exactly as the user typed it. */
	ticketPath: string;
	/** `--ref` exactly as the user typed it, when one was typed. */
	flaggedRef: string | undefined;
}

/**
 * The dirty-tree guard runs before the input copy, so it judges the tree the
 * run will commit rather than a tree the copy has already touched.
 */
export const openDirectWorkspace = async ({
	cwd,
	config,
	flags,
	ticketPath,
	flaggedRef,
}: Params): Promise<{ workspace: RunWorkspace; ticketPath: string } | { error: string }> => {
	const workspace = await resolveRunWorkspace({
		cwd,
		config,
		flags,
		ticketPath,
		ticketRef: flaggedRef,
		onProgress: createProgressPrinter(),
	});

	if ('error' in workspace) {
		return { error: workspace.error };
	}

	// Empty: a fresh run commits with `keepGenerated` false, so its commit discards changed generated paths — exempting them would start it over a person's uncommitted build output and then delete it.
	const uncommittable = await describeUncommittableTree({ cwd: workspace.cwd, isolated: workspace.isolated, generated: [] });

	if (uncommittable !== undefined) {
		return { error: uncommittable };
	}

	const copied = await copyRunInputs({ sourceCwd: cwd, workspace: workspace.cwd, ticketPath });

	return 'error' in copied ? { error: copied.error } : { workspace, ticketPath: copied.ticketPath ?? ticketPath };
};
