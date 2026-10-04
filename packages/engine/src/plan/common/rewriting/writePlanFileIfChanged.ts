import { writeFile } from 'node:fs/promises';
import type { SyncedPlanFile } from '#src/plan/common/types/SyncedPlanFile.ts';

interface Params {
	/** Absolute. */
	path: string;
	original: string;
	lines: string[];
}

/** Section syncs repeat often, and a rewrite with identical content would move the modification time and make every consumer look again for nothing. */
export const writePlanFileIfChanged = async ({ path, original, lines }: Params): Promise<SyncedPlanFile> => {
	const rewritten = lines.join('\n');
	const updated = rewritten !== original;

	if (updated) {
		await writeFile(path, rewritten, 'utf8');
	}

	return { path, updated };
};
