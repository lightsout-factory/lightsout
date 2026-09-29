import { stat } from 'node:fs/promises';

interface Params {
	path: string;
}

/** Any `stat` rejection, permission included, reads as not existing. */
export const pathExists = ({ path }: Params): Promise<boolean> =>
	stat(path).then(
		() => true,
		() => false,
	);
