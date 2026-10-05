import { stat } from 'node:fs/promises';

interface Params {
	/** Absolute path of the file to look for. */
	path: string;
}

/** An unreadable path means "no marker file here", never an error to report. */
export const hasFile = async ({ path }: Params): Promise<boolean> =>
	stat(path).then(
		() => true,
		() => false,
	);
