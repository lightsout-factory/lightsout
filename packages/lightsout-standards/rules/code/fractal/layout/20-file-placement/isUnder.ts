interface Params {
	path: string;
	/** A `/`-joined folder path, '' for the repo root. */
	folder: string;
}

export const isUnder = ({ path, folder }: Params): boolean => folder === '' || path.startsWith(`${folder}/`);
