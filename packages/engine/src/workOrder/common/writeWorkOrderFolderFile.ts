import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

interface Params {
	/** The file's own path inside the primary checkout's work order folder. */
	path: string;
	content: Buffer;
}

/** The temporary name is fixed rather than unique because every caller holds the record's exclusive lock. */
export const writeWorkOrderFolderFile = async ({ path, content }: Params): Promise<void> => {
	const temporaryPath = `${path}.tmp`;

	await mkdir(dirname(path), { recursive: true });
	await writeFile(temporaryPath, content);
	await rename(temporaryPath, path);
};
