import { contradictoryWorktreeFlagsMessage } from '#src/cli/internal/common/constants/contradictoryWorktreeFlagsMessage.ts';

interface Params {
	flags: Map<string, string | true>;
	/** The command's own config key — `implement.worktree` or `plan.worktree` — undefined when the config says nothing. */
	configured: boolean | undefined;
}

/**
 * Decided from the flags and config alone, so a caller can settle isolation
 * before anything touches git — the order `resolveRunWorkspace` and
 * `resolvePlanWorktree` both depend on.
 */
export const resolveWorktreeIsolation = ({ flags, configured }: Params): boolean | { error: string } => {
	const asked = flags.get('worktree') === true;
	const refused = flags.get('no-worktree') === true;

	if (asked && refused) {
		return { error: contradictoryWorktreeFlagsMessage };
	}

	return refused ? false : asked || (configured ?? true);
};
