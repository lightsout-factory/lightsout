import { readGitCurrentBranch } from '#src/common/git/readGitCurrentBranch.ts';
import { findWorkOrderForBranch } from '#src/common/workspace/findWorkOrderForBranch.ts';

interface Params {
	cwd: string;
}

/**
 * Asks the record rather than the branch's spelling, so a branch may carry a prefix and a reference
 * the tracker's capitals. It lives here rather than in `ship` because `ship` may not import this
 * module: the reverse edge exists, and this would close a cycle.
 */
export const readWorkOrderTicketRef = async ({ cwd }: Params): Promise<string | undefined> => {
	const branch = await readGitCurrentBranch({ cwd });

	if (branch === undefined) {
		return undefined;
	}

	return (await findWorkOrderForBranch({ cwd, branch }))?.record.ticketRef;
};
