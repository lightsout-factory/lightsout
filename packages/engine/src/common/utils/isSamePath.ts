import { realpath } from 'node:fs/promises';

interface Params {
	path: string;
	otherPath: string;
}

/**
 * Git answers filesystem-resolved paths while the worktree layout uses the
 * checkout as the caller spelled it, so a checkout behind a symlink has two
 * spellings. A path that does not exist yet falls back to its literal spelling.
 */
export const isSamePath = async ({ path, otherPath }: Params): Promise<boolean> => {
	const [real, otherReal] = await Promise.all([path, otherPath].map((candidate) => realpath(candidate).catch(() => candidate)));

	return real === otherReal;
};
