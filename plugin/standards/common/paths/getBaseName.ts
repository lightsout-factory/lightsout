interface Params {
	/** A repo-relative path, always `/`-separated as every input the engine builds is. */
	path: string;
}

export const getBaseName = ({ path }: Params): string => path.slice(path.lastIndexOf('/') + 1);
