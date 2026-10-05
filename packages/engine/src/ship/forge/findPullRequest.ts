import type { PullRequestState } from '#src/common/constants/PullRequestState.ts';
import type { PullRequestSummary } from '#src/common/types/PullRequestSummary.ts';
import { parseForgeJson } from '#src/ship/forge/common/parseForgeJson.ts';
import { runGh } from '#src/ship/forge/common/runGh.ts';
import { toPullRequestSummary } from '#src/ship/forge/common/toPullRequestSummary.ts';

interface Params {
	branch: string;
	cwd: string;
	state: PullRequestState;
}

/**
 * Anything unreadable answers undefined, and both callers depend on that: asked
 * for `Merged`, absence of evidence must never become evidence of a merge.
 */
export const findPullRequest = async ({ branch, cwd, state }: Params): Promise<PullRequestSummary | undefined> => {
	const listed = await runGh({
		args: ['pr', 'list', '--head', branch, '--state', state, '--json', 'number,url,title,headRefName', '--limit', '1'],
		cwd,
	});
	const rows = listed.exitCode === 0 ? parseForgeJson({ stdout: listed.stdout }) : undefined;

	return Array.isArray(rows) ? toPullRequestSummary({ row: rows[0] }) : undefined;
};
