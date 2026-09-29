import { resolve } from 'node:path';

interface Params {
	cwd: string;
}

/**
 * Absolute because the file is tracked, so every linked worktree carries its own
 * copy: a relative `--cwd` would print a path that cannot tell two checkouts apart.
 */
export const resolveConfigPath = ({ cwd }: Params): string => resolve(cwd, 'lightsout.config.json');
