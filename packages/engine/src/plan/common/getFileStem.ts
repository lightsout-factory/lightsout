import { parse } from 'node:path';

interface Params {
	/** A repo-relative path, or a bare file name. */
	path: string;
}

/** A file's name without its directory or its last extension: the name a plan's reader would search by. */
export const getFileStem = ({ path }: Params): string => parse(path).name;
