import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';
import { resolveWorktreesRoot } from '#src/worktree/resolveWorktreesRoot.ts';

interface Params {
	path: string;
	/** Any checkout of the repository; the worktrees root is derived from its primary. */
	cwd: string;
	/** Every work order admitted so far, in admission order. */
	queued: NamedWorkOrder[];
}

/**
 * The branch and worktree come off the entry rather than the queue's branch
 * template, so the document names the branch and directory the drain actually
 * builds in.
 */
export const writeQueuePlan = async ({ path, cwd, queued }: Params): Promise<void> => {
	const root = await resolveWorktreesRoot({ cwd });
	const lines = queued.map(
		(workOrder) => `- ${workOrder.ticket.identifier} · ${workOrder.ticket.worker} · ${workOrder.branch} · ${join(root, workOrder.name)}`,
	);

	await writeFile(path, `# queue drain\n\n${lines.join('\n')}\n`, 'utf8');
};
