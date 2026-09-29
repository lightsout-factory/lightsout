import { z } from 'zod';
import type { PullRequestSummary } from '#src/ship/forge/common/types/PullRequestSummary.ts';

interface Params {
	/** One decoded row of `--json number,url,title,headRefName`, or nothing at all when the forge returned no rows. */
	row: unknown;
}

const PullRequestRow = z.object({ number: z.number(), url: z.string(), title: z.string(), headRefName: z.string() });

/**
 * Parsed rather than cast: a summary carrying an undefined number would reach
 * the merge step as `gh pr merge undefined`.
 */
export const toPullRequestSummary = ({ row }: Params): PullRequestSummary | undefined => {
	const parsed = PullRequestRow.safeParse(row);

	return parsed.success ? { number: parsed.data.number, url: parsed.data.url, title: parsed.data.title, branch: parsed.data.headRefName } : undefined;
};
