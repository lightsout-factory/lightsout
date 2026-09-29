interface Params {
	/** Repo-relative path — both the folder it sits in and its name decide the answer. */
	path: string;
	/** The workspace's packages folder, so a package root is recognised as a root. */
	packagesDir: string;
}

/**
 * A tool's own settings file is read by the tool and never imported under test,
 * so demanding a test run it reports a fault no test could fix. Only a file at
 * the repo root or a package root counts: `src/feature.config.ts` is ordinary
 * code.
 */
export const isToolingConfigFile = ({ path, packagesDir }: Params): boolean => {
	const segments = path.split('/');
	const name = segments.at(-1) ?? '';
	const folder = segments.slice(0, -1);

	if (!/\.config\.(c|m)?[jt]s$/i.test(name)) {
		return false;
	}

	// A root is the repo itself (no folder) or one package folder inside the
	// packages dir — anything deeper is a source tree.
	return folder.length === 0 || (folder.length === 2 && folder[0] === packagesDir);
};
