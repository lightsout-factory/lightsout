import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

interface Params {
	cwd: string;
	dirs: string[];
}

/** A path that does not exist yet (a plan folder before the session writes it) falls back to its literal spelling. */
const resolveReal = ({ path }: { path: string }) => realpath(path).catch(() => resolve(path));

/**
 * A harness already lets a session write its own working directory, so only the
 * directories outside it need granting. The comparison is segment-aligned, so a
 * sibling whose name merely starts with the cwd's name counts as outside. The
 * kept directories keep their input spelling and order.
 */
export const getDirsOutsideCwd = async ({ cwd, dirs }: Params): Promise<string[]> => {
	const realCwd = await resolveReal({ path: cwd });
	const realDirs = await Promise.all(dirs.map((dir) => resolveReal({ path: dir })));

	return dirs.filter((_dir, index) => {
		const fromCwd = relative(realCwd, realDirs[index] ?? '');

		return fromCwd === '..' || fromCwd.startsWith('../') || isAbsolute(fromCwd);
	});
};
