import type { FrameworkCarveOut } from '../types/FrameworkCarveOut.ts';

const noCarveOut: FrameworkCarveOut = { directory: '.', entryFiles: [], exemptFolderNames: [], routerRoots: [] };

interface Params {
	/** Every package's carve-outs, longest directory first — the order `getFrameworkCarveOuts` returns them in. */
	carveOuts: FrameworkCarveOut[];
	/** A repo-relative file or folder path. */
	path: string;
}

/** The first match is the nearest package's, since the list is ordered longest directory first. */
export const getPathCarveOut = ({ carveOuts, path }: Params): FrameworkCarveOut =>
	carveOuts.find(({ directory }) => directory === '.' || path.startsWith(`${directory}/`)) ?? noCarveOut;
