import { z } from 'zod';

export const PlanWorkspaceFile = z.object({
	/** Workspace-relative name, e.g. 'implemented/phase1-design-system.md'. */
	name: z.string(),
	/** Repo-relative path, ready for `getPlanDocument`. */
	path: z.string(),
	bytes: z.number(),
	/** ISO mtime. */
	updatedAt: z.string(),
});

export type PlanWorkspaceFile = z.infer<typeof PlanWorkspaceFile>;
