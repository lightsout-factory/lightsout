import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveRecordedPlanPath } from '#src/common/resolveRecordedPlanPath.ts';

interface Params {
	cwd: string;
	/** The --plan value exactly as the user gave it. */
	planPath: string;
}

/**
 * A missing path passes through unchanged, because the pipeline already owns
 * the missing-file error.
 *
 * The folder is looked for through `resolveRecordedPlanPath`, not `cwd`: a plan
 * folder lives in the primary checkout, so a run isolated in a worktree would
 * otherwise take a plan folder for a plain file.
 */
export const resolvePlanTarget = async ({ cwd, planPath }: Params): Promise<{ planPath: string } | { overviewPath: string } | { error: string }> => {
	const dir = await resolveRecordedPlanPath({ cwd, path: planPath });
	const isDirectory = await stat(dir).then(
		(entry) => entry.isDirectory(),
		() => false,
	);

	if (!isDirectory) {
		return { planPath };
	}

	const holds = async ({ name }: { name: string }) =>
		stat(join(dir, name)).then(
			(entry) => entry.isFile(),
			() => false,
		);

	// Built from the user's own path, not the resolved absolute, so a relative
	// --plan stays relative — the form manifests store.
	if (await holds({ name: 'overview.md' })) {
		return { overviewPath: join(planPath, 'overview.md') };
	}

	if (await holds({ name: 'plan.md' })) {
		return { planPath: join(planPath, 'plan.md') };
	}

	return { error: `plan folder holds neither overview.md nor plan.md: ${planPath}` };
};
