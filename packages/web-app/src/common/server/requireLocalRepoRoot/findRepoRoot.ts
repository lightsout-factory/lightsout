import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

/**
 * `LIGHTSOUT_REPO` when set, otherwise the nearest ancestor of the working
 * directory holding a `lightsout.config.json`.
 *
 * The walk is needed because `pnpm start:dev` runs the server with
 * `packages/web-app` as its working directory. The config file is the marker
 * because a fresh clone has no `.lightsout/` yet.
 *
 * Resolved on every call and never cached, so a dev server restarted with a
 * different value picks it up.
 */
export const findRepoRoot = (): string | undefined => {
	const configured = process.env.LIGHTSOUT_REPO;

	if (configured !== undefined && configured !== '') {
		return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
	}

	let directory = process.cwd();
	let root: string | undefined;
	let searching = true;

	while (searching) {
		const parent = dirname(directory);

		if (existsSync(resolve(directory, 'lightsout.config.json'))) {
			root = directory;
			searching = false;
		} else if (parent === directory) {
			searching = false;
		} else {
			directory = parent;
		}
	}

	return root;
};
