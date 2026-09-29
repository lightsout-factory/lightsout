/**
 * `1` is the public site: `/app` does not exist and its server functions
 * refuse. Unset, empty or `0` is a local dev server.
 *
 * Any other value throws, because a typo such as `true` would otherwise read as
 * local and put `/app` on a public site unnoticed.
 *
 * `vite.config.ts` calls this at build time and bakes the value into the
 * bundle, because a host's function runtime is not guaranteed the build's
 * environment.
 *
 * @throws {Error} When `LIGHTSOUT_PUBLIC` holds anything but `1`, `0` or nothing.
 */
export const isPublicDeployment = (): boolean => {
	const value = process.env.LIGHTSOUT_PUBLIC;

	if (value === '1') {
		return true;
	}

	if (value === undefined || value === '' || value === '0') {
		return false;
	}

	throw new Error(`LIGHTSOUT_PUBLIC is '${value}' — set it to 1 for the public site, or leave it unset (or 0) for a local dev server.`);
};
