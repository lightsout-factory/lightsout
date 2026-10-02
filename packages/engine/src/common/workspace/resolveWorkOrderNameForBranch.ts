import { findWorkOrderForBranch } from '#src/common/workspace/findWorkOrderForBranch.ts';

interface Params {
	/** Any checkout of the repository. */
	cwd: string;
	/** The branch as git names it. */
	branch: string;
}

/**
 * The label a branch's work order is pulled and updated by: the local record that saves the
 * branch, else the branch itself. The fallback reaches only a local record labelled with the
 * branch's own name. A machine holding no local copy of the record finds nothing and checks
 * nothing, because the ticket a work order belongs to is known only from its local record, so the
 * tracker is never reached without one.
 */
export const resolveWorkOrderNameForBranch = async ({ cwd, branch }: Params): Promise<string> =>
	(await findWorkOrderForBranch({ cwd, branch }))?.name ?? branch;
