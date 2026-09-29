import { z } from 'zod';
import { WorktreeOwner } from '#src/contracts/worktree/WorktreeOwner.ts';

/**
 * Lives in the PRIMARY checkout, not the tree it describes: it has to outlive
 * the removal it attributes, and every linked worktree must read the same file.
 * It is deleted only after a removal that worked, so a tree that survived a
 * failed removal still names its owner.
 */
export const WorktreeRecord = z.object({
	branch: z.string(),
	owner: z.enum(WorktreeOwner),
	worktreePath: z.string(),
	/** ISO timestamp. */
	createdAt: z.string(),
	/** `origin/<default>` for a queue or implement tree, a commit sha for a planning tree pinned to the launching checkout's HEAD. */
	startPoint: z.string().optional(),
});

export type WorktreeRecord = z.infer<typeof WorktreeRecord>;
