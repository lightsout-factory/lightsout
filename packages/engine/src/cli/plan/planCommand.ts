import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import { usage } from '#src/cli/common/constants/usage.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { getListFlag } from '#src/cli/internal/common/args/getListFlag.ts';
import { getPositionals } from '#src/cli/internal/common/args/getPositionals.ts';
import { getRequiredFlag } from '#src/cli/internal/common/args/getRequiredFlag.ts';
import { printConfigSource } from '#src/cli/internal/common/render/printConfigSource.ts';
import { describeMissingPlanAddress } from '#src/cli/internal/common/utils/describeMissingPlanAddress.ts';
import { resolveConfigAndDriver } from '#src/cli/internal/common/utils/resolveConfigAndDriver.ts';
import { openPlanWorktree } from '#src/cli/plan/internal/common/utils/openPlanWorktree.ts';
import { planWorkspaceCommand } from '#src/cli/plan/internal/planWorkspaceCommand.ts';
import { planDedupCommand } from '#src/cli/plan/planDedupCommand.ts';
import { planDraftCommand } from '#src/cli/plan/planDraftCommand.ts';
import { planGradeCommand } from '#src/cli/plan/planGradeCommand.ts';
import { planLintCommand } from '#src/cli/plan/planLintCommand.ts';
import { planPublishCommand } from '#src/cli/plan/planPublishCommand.ts';
import { planSyncDecisionsCommand } from '#src/cli/plan/planSyncDecisionsCommand.ts';
import { planVerifyFactsCommand } from '#src/cli/plan/planVerifyFactsCommand.ts';
import { readPlanningStandards } from '#src/cli/plan/readPlanningStandards.ts';
import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress.ts';

/**
 * An unknown subcommand is left unopened so it still reaches the usage error with
 * nothing printed ahead of it. The config read is the launching checkout's, so an
 * uncommitted `plan.worktree` edit is obeyed.
 *
 * A `--name` that is not a plan address (`<work order>/<plan id>`) is refused
 * before any tree is cut: a bare folder name names no plan, and every subcommand
 * would act on the wrong thing.
 */
const openDispatchCheckout = async ({ cwd, flags, subcommand }: { cwd: string; flags: CommandContext['flags']; subcommand: string | undefined }) => {
	const name = getStringFlag({ flags, name: 'name' });

	if (name === undefined || !['workspace', 'draft', 'dedup', 'grade', 'lint', 'publish', 'sync-decisions', 'verify-facts'].includes(subcommand ?? '')) {
		return { cwd, worktree: undefined };
	}

	if (parsePlanAddress({ name }) === undefined) {
		console.error(describeMissingPlanAddress({ name, missing: 'plan to act on' }));
		return exitCli({ code: 1 });
	}

	const opened = await openPlanWorktree({ cwd, config: await readOptionalConfig({ cwd }), flags, name });

	if ('error' in opened) {
		console.error(opened.error);
		return exitCli({ code: 1 });
	}

	return { cwd: opened.worktree.cwd, worktree: opened.worktree };
};

export const planCommand = async ({ flags, rest, cwd: launchingCwd }: CommandContext): Promise<void> => {
	const subcommand = getPositionals({ args: rest })[0];

	// `workspace` has no --name refusal of its own, so a nameless one is refused
	// here, before any tree is established for it.
	if (subcommand === 'workspace') {
		await getRequiredFlag({ flags, name: 'name' });
	}

	const { cwd, worktree } = await openDispatchCheckout({ cwd: launchingCwd, flags, subcommand });

	if (subcommand === 'workspace' && worktree !== undefined) {
		await planWorkspaceCommand({ worktree });
		return;
	}

	if (subcommand === 'verify-facts') {
		await planVerifyFactsCommand({ flags, rest, cwd });
		return;
	}

	if (subcommand === 'lint') {
		await planLintCommand({ flags, rest, cwd });
		return;
	}

	if (subcommand === 'sync-decisions') {
		await planSyncDecisionsCommand({ flags, rest, cwd });
		return;
	}

	if (subcommand === 'publish') {
		await planPublishCommand({ flags, rest, cwd });
		return;
	}

	if (subcommand === 'draft' || subcommand === 'dedup' || subcommand === 'grade') {
		const name = await getRequiredFlag({ flags, name: 'name' });
		const { config, driver, configPath } = await resolveConfigAndDriver({ cwd, command: 'plan' });

		printConfigSource({ configPath });

		const standards = await readPlanningStandards({ cwd, config });

		if (subcommand === 'draft') {
			await planDraftCommand({ cwd, driver, name, standards, config, flags });
			return;
		}

		if (subcommand === 'dedup') {
			await planDedupCommand({ cwd, driver, name, standards, config });
			return;
		}

		// A `--phase` yielding no values reaches the runner as an empty list, which
		// it refuses rather than silently grading less than was asked.
		const phases = getListFlag({ flags, name: 'phase' });

		await planGradeCommand({ cwd, driver, name, standards, config, phases });
		return;
	}

	console.error(usage);
	return exitCli({ code: 1 });
};
