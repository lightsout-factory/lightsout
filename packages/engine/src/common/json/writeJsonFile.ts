import { rename, writeFile } from 'node:fs/promises';

interface Params {
	path: string;
	value: unknown;
	/** Write a sibling .tmp file and rename it over the path, so a reader in another process never sees half a file. */
	atomic?: boolean;
}

/** The canonical on-disk shape for every manifest, report and trace, so they diff and format identically. */
export const writeJsonFile = async ({ path, value, atomic = false }: Params): Promise<void> => {
	const content = `${JSON.stringify(value, undefined, '\t')}\n`;

	if (atomic) {
		await writeFile(`${path}.tmp`, content, 'utf8');
		await rename(`${path}.tmp`, path);
	} else {
		await writeFile(path, content, 'utf8');
	}
};
