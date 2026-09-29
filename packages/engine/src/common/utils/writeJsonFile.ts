import { writeFile } from 'node:fs/promises';

interface Params {
	path: string;
	value: unknown;
}

/** The canonical on-disk shape for every manifest, report and trace, so they diff and format identically. */
export const writeJsonFile = async ({ path, value }: Params): Promise<void> => {
	await writeFile(path, `${JSON.stringify(value, undefined, '\t')}\n`, 'utf8');
};
