interface Params {
	/** Whatever the forge wrote to stdout — JSON when the call worked, anything at all when it did not. */
	stdout: string;
}

/**
 * A `gh` that printed a login prompt, a rate-limit page or nothing must become
 * "no answer" rather than an exception thrown out of a ship step.
 */
export const parseForgeJson = ({ stdout }: Params): unknown => {
	try {
		return JSON.parse(stdout);
	} catch {
		return undefined;
	}
};
