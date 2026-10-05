import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StandardsSnapshot } from '#src/contracts/standardsCheck/StandardsSnapshot.ts';
import { getStandardsCheckPath } from '#src/standardsCheck/common/getStandardsCheckPath.ts';
import { getStandardsSnapshotsDir } from '#src/standardsCheck/common/getStandardsSnapshotsDir.ts';

interface Params {
	cwd: string;
	snapshot: StandardsSnapshot;
}

/** The dated file's name comes from `snapshot.at` rather than a second clock reading, so the pair can never disagree about when the check ran. */
export const writeStandardsSnapshot = async ({ cwd, snapshot }: Params): Promise<void> => {
	const body = `${JSON.stringify(snapshot, undefined, '\t')}\n`;
	const snapshotsDir = getStandardsSnapshotsDir({ cwd });
	// Colons and dots are legal in the timestamp and not in a Windows filename.
	const fileName = `${snapshot.at.replaceAll(':', '-').replaceAll('.', '-')}.json`;

	await mkdir(snapshotsDir, { recursive: true });
	await writeFile(getStandardsCheckPath({ cwd }), body, 'utf8');
	await writeFile(join(snapshotsDir, fileName), body, 'utf8');
};
