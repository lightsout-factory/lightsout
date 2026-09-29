import { relative, resolve } from 'node:path';

interface Params {
	cwd: string;
	/** A path as a caller named it — cwd-relative or absolute. */
	path: string;
}

/**
 * Run state records every path relative to the target repo, so the same file
 * named either way is recorded the same way and a guard comparing two records
 * sees one plan rather than two.
 */
export const toRepoRelativePath = ({ cwd, path }: Params): string => relative(cwd, resolve(cwd, path));
