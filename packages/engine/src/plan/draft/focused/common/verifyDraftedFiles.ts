import { isAbsolute, join } from 'node:path';
import { pathExists } from '#src/common/paths/pathExists.ts';

interface Params {
	cwd: string;
	filesWritten: { path: string }[];
}

/** The agent owns a plan's content but never the claim that it exists: a report naming unwritten files would otherwise pass as a clean draft. */
export const verifyDraftedFiles = async ({ cwd, filesWritten }: Params): Promise<{ planPaths: string[] } | { error: string }> => {
	const planPaths = filesWritten.map((file) => (isAbsolute(file.path) ? file.path : join(cwd, file.path)));

	if (planPaths.length === 0) {
		return { error: 'plan-writer reported drafted but listed no files written' };
	}

	const missing: string[] = [];

	for (const path of planPaths) {
		if (!(await pathExists({ path }))) {
			missing.push(path);
		}
	}

	if (missing.length > 0) {
		return { error: `plan-writer reported files that were not written: ${missing.join(', ')}` };
	}

	return { planPaths };
};
