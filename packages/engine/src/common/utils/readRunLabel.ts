import { readGitCurrentBranch } from '#src/common/git/readGitCurrentBranch.ts';
import { readWorkOrderTicketRef } from '#src/workOrder/readWorkOrderTicketRef.ts';

interface Params {
	/** The checkout to read. For an isolated run that is the workspace it was just put on, never wherever the command was typed. */
	cwd: string;
}

/**
 * One ladder for both `implement-direct`'s run label and a plan run's commit
 * subject, so what a commit is addressed by cannot drift between the two. It
 * only labels, so a branch no work order claims is named rather than refused;
 * the last rung is `work` rather than `ticket` because most repositories have
 * no tracker.
 */
export const readRunLabel = async ({ cwd }: Params): Promise<string> =>
	(await readWorkOrderTicketRef({ cwd })) ?? (await readGitCurrentBranch({ cwd })) ?? 'work';
