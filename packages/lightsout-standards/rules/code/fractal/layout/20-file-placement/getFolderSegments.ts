import { getDirectory } from '#common/paths/getDirectory.ts';

interface Params {
	/** A repo-relative path. */
	path: string;
}

/** The folder a file sits in, as segments; none for the repo root. */
export const getFolderSegments = ({ path }: Params): string[] => {
	const directory = getDirectory({ path });

	return directory === '.' ? [] : directory.split('/');
};
