import { z } from 'zod';
import type { ShipMergeMethod } from '#src/contracts/ship/ShipMergeMethod.ts';
import type { ShipStepFailure } from '#src/ship/common/types/ShipStepFailure.ts';
import { parseForgeJson } from '#src/ship/forge/internal/common/utils/parseForgeJson.ts';
import { runGh } from '#src/ship/forge/internal/runGh.ts';
import { remoteWaitTimings } from '#src/ship/internal/common/constants/remoteWaitTimings.ts';
import { sleep } from '#src/ship/internal/common/utils/sleep.ts';

interface Params {
	prNumber: number;
	mergeMethod: ShipMergeMethod;
	cwd: string;
	/** The exact commit this invocation pushed and verified — the only head it may ever merge. */
	expectedHead: string;
}

/**
 * Everything past `state` and `mergeCommit` is optional: a forge that answers
 * an older field set still lets a confirmed merge be recognised.
 */
const StateView = z.object({
	state: z.string(),
	mergeCommit: z.object({ oid: z.string() }).nullable(),
	headRefOid: z.string().optional(),
	mergeStateStatus: z.string().optional(),
	reviewDecision: z.string().nullable().optional(),
});

type StateView = z.infer<typeof StateView>;

const humanReviewDecisions = new Set(['REVIEW_REQUIRED', 'CHANGES_REQUESTED']);

const readState = async ({ prNumber, cwd }: { prNumber: number; cwd: string }) => {
	const viewed = await runGh({ args: ['pr', 'view', String(prNumber), '--json', 'state,mergeCommit,headRefOid,mergeStateStatus,reviewDecision'], cwd });
	const view = StateView.safeParse(parseForgeJson({ stdout: viewed.stdout }));

	return { view: view.success ? view.data : undefined, stderr: viewed.stderr };
};

/**
 * Read from the structured state, never the message: GitHub prints the same
 * "Base branch was modified" sentence for refusals a retry cannot fix.
 */
const isStaleBase = ({ view, expectedHead }: { view: StateView | undefined; expectedHead: string }) =>
	view !== undefined &&
	view.headRefOid === expectedHead &&
	view.state === 'OPEN' &&
	view.mergeStateStatus === 'BEHIND' &&
	!humanReviewDecisions.has(view.reviewDecision ?? '');

/**
 * A merge queue answers with a zero exit and merges minutes later. The command
 * is never re-sent; only the read-back is repeated.
 */
const confirmMerge = async ({ prNumber, cwd, mergeStderr }: { prNumber: number; cwd: string; mergeStderr: string }): Promise<string | ShipStepFailure> => {
	const { pollIntervalMs, ceilingMs } = remoteWaitTimings;
	const startedAt = Date.now();
	let last: StateView | undefined;
	let lastStderr = mergeStderr;

	for (;;) {
		const { view, stderr } = await readState({ prNumber, cwd });

		last = view;
		lastStderr = stderr.trim() === '' ? lastStderr : stderr;

		if (view?.state === 'MERGED') {
			return view.mergeCommit === null ? { stderr: lastStderr } : view.mergeCommit.oid;
		}

		if (Date.now() - startedAt >= ceilingMs) {
			return { stderr: `the forge accepted the merge but #${prNumber} is still ${last?.state ?? 'unreadable'} at the wait ceiling` };
		}

		await sleep({ ms: pollIntervalMs });
	}
};

/**
 * `--match-head-commit` makes the merge conditional, so a commit somebody else
 * pushed while the checks ran cannot be merged under this invocation's
 * evidence. A non-zero exit whose read-back says MERGED is a merge, because
 * `gh pr merge` also does local cleanup that always fails inside a linked
 * worktree.
 *
 * @returns the merge commit, or the refusal — carrying `staleBase` only when the forge's own state proved a newer base is the whole problem
 */
export const mergePullRequest = async ({ prNumber, mergeMethod, cwd, expectedHead }: Params): Promise<string | ShipStepFailure> => {
	const merged = await runGh({
		args: ['pr', 'merge', String(prNumber), `--${mergeMethod}`, '--delete-branch', '--match-head-commit', expectedHead],
		cwd,
	});

	if (merged.exitCode === 0) {
		return confirmMerge({ prNumber, cwd, mergeStderr: merged.stderr });
	}

	const { view } = await readState({ prNumber, cwd });

	if (view?.state === 'MERGED' && view.mergeCommit !== null) {
		return view.mergeCommit.oid;
	}

	return isStaleBase({ view, expectedHead }) ? { stderr: merged.stderr, staleBase: true } : { stderr: merged.stderr };
};
