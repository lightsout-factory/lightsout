import { join } from 'node:path';
import { resolveSharedStateDir } from '#src/common/workspace/resolveSharedStateDir.ts';

interface Params {
	/** Any checkout of the repository; the primary is resolved from it. */
	cwd: string;
}

/**
 * Not keyed by branch or ticket: every run of the repository appends to one
 * ledger, which is what lets the improvement loop see patterns across runs.
 */
export const getFrictionPath = async ({ cwd }: Params): Promise<string> => {
	return join(await resolveSharedStateDir({ cwd }), 'friction.jsonl');
};
