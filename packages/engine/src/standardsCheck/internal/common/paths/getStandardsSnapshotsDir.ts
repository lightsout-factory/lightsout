import { join } from 'node:path';

interface Params {
	cwd: string;
}

/**
 * The dated-snapshots directory and the latest-snapshot file differ only by
 * extension on purpose, so the dated copies sit under a name that says what they are.
 */
export const getStandardsSnapshotsDir = ({ cwd }: Params): string => {
	return join(cwd, '.lightsout', 'standards-check');
};
