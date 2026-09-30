interface Params {
	/** A repo-relative path, always `/`-separated as every input the engine builds is. */
	path: string;
}

/**
 * String work rather than `node:path`, because a check imports values from
 * inside its own package alone, and the paths it is handed are `/`-separated
 * whatever the machine.
 */
export const getDirectory = ({ path }: Params): string => {
	const cut = path.lastIndexOf('/');

	return cut === -1 ? '.' : path.slice(0, cut);
};
