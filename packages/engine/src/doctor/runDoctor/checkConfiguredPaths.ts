import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { DoctorCheck } from '#src/doctor/runDoctor/common/types/DoctorCheck.ts';

interface Params {
	cwd: string;
	/** The config key the paths came from, which is also the check's id. */
	id: 'generated' | 'vendored';
	paths?: string[];
	/** The exact change that clears a warn — a stale generated path and a stale vendored one are fixed differently. */
	fix: string;
}

/** An exclusion that matches nothing hides no files, so it fails invisibly unless reported. */
export const checkConfiguredPaths = async ({ cwd, id, paths, fix }: Params): Promise<DoctorCheck | undefined> => {
	if (!paths) {
		return undefined;
	}

	const absent: string[] = [];

	for (const prefix of paths) {
		await stat(join(cwd, prefix)).catch(() => absent.push(prefix));
	}

	return absent.length === 0
		? { id, status: 'pass', detail: `${paths.length} ${id} path(s) exist` }
		: { id, status: 'warn', detail: `not found: ${absent.join(', ')}`, fix };
};
