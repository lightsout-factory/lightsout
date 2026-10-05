import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { readGitCurrentBranch } from '#src/common/git/readGitCurrentBranch.ts';
import { readGitDefaultBranch } from '#src/common/git/readGitDefaultBranch.ts';
import { ShipBlockReason } from '#src/contracts/ship/ShipBlockReason.ts';
import { readTicketMatch } from '#src/ship/common/readTicketMatch.ts';
import { readForgeAuth } from '#src/ship/forge/readForgeAuth.ts';

interface Params {
	cwd: string;
	ticketPattern: RegExp;
}

interface ShipPreconditionsMet {
	branch: string;
	/** Read here rather than again later, so the sync step and the "not on it" check cannot disagree. */
	defaultBranch: string;
	/** The branch's ticket capture groups — `ticket` plus whatever else the pattern names. */
	ticket: Record<string, string>;
}

interface ShipPreconditionsBlocked {
	reason: ShipBlockReason;
	detail: string;
	branch?: string;
}

type ShipPreconditions = ShipPreconditionsMet | ShipPreconditionsBlocked;

const describeDirtyTree = ({ changed }: { changed: string[] | undefined }) => {
	const shownPaths = 5;

	if (changed === undefined) {
		return 'git could not list the working tree, so ship cannot tell whether it is clean';
	}

	const shown = changed.slice(0, shownPaths).join(', ');
	const rest = changed.length > shownPaths ? `, and ${changed.length - shownPaths} more` : '';

	return `working tree is not clean: ${shown}${rest}`;
};

/**
 * Checked in the order that names the first real problem rather than a cascade. Pushing is not a
 * precondition, so an unpushed branch is shippable and `implement --ship` can chain off its own commit.
 */
export const checkShipPreconditions = async ({ cwd, ticketPattern }: Params): Promise<ShipPreconditions> => {
	const branch = await readGitCurrentBranch({ cwd });

	if (branch === undefined) {
		return { reason: ShipBlockReason.GitUnreadable, detail: `not on a branch in a git worktree at ${cwd}` };
	}

	const defaultBranch = await readGitDefaultBranch({ cwd });

	if (defaultBranch === undefined) {
		return { reason: ShipBlockReason.DefaultBranch, detail: 'origin/HEAD is unset, so ship cannot tell what it would merge into', branch };
	}

	if (defaultBranch === branch) {
		return { reason: ShipBlockReason.DefaultBranch, detail: `already on the default branch '${branch}'`, branch };
	}

	const changed = await readGitChangedFiles({ cwd });

	if (changed === undefined || changed.length > 0) {
		return { reason: ShipBlockReason.DirtyTree, detail: describeDirtyTree({ changed }), branch };
	}

	const ticket = readTicketMatch({ branch, ticketPattern });

	if (ticket === undefined) {
		return { reason: ShipBlockReason.TicketPatternMismatch, detail: `branch '${branch}' does not match ${ticketPattern.source}`, branch };
	}

	if (!(await readForgeAuth({ cwd }))) {
		return { reason: ShipBlockReason.ForgeNotAuthenticated, detail: 'gh is not installed, or is not logged in for this repository’s host', branch };
	}

	return { branch, defaultBranch, ticket };
};
