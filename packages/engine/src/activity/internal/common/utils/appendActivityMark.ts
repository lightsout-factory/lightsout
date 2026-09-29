import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ActivityMark } from '#src/contracts/activity/ActivityMark.ts';

interface Params {
	path: string;
	mark: ActivityMark;
}

/**
 * A failed write is swallowed: evidence must never fail the work it describes.
 *
 * Not `appendJsonlRecords`, which stamps a run id and step this record does not have.
 */
export const appendActivityMark = async ({ path, mark }: Params): Promise<void> => {
	await mkdir(dirname(path), { recursive: true })
		.then(() => appendFile(path, `${JSON.stringify(mark)}\n`, 'utf8'))
		.catch(() => undefined);
};
