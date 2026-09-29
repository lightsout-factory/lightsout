import { join } from 'node:path';
import { resolveSharedStateDir } from '#src/common/workspace/resolveSharedStateDir.ts';

interface Params {
	cwd: string;
}

interface GateHoldPaths {
	dir: string;
	pathFor: ({ identifier }: { identifier: string }) => string;
}

/** Inside the shared `.lightsout` directory, so every worktree of one repository reads the same set. */
export const getGateHoldPaths = async ({ cwd }: Params): Promise<GateHoldPaths> => {
	const dir = join(await resolveSharedStateDir({ cwd }), 'gate-holds');

	return { dir, pathFor: ({ identifier }) => join(dir, `${identifier.toLowerCase()}.json`) };
};
