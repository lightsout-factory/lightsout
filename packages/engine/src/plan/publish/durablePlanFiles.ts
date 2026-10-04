import { basename, join } from 'node:path';
import { pathExists } from '#src/common/pathExists.ts';
import { durablePlanFileNames } from '#src/plan/common/constants/durablePlanFileNames.ts';
import { resolvePlanDeliverable } from '#src/plan/common/resolvePlanDeliverable.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import type { DurablePlanFile } from '#src/plan/publish/common/types/DurablePlanFile.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the folder the plan's own files live in. */
	name: string;
}

interface DurableSet {
	files: DurablePlanFile[];
	error?: string;
}

/**
 * What a plan *is* is answered by `resolvePlanDeliverable` and nowhere else. The
 * working records are each kept only when the folder holds them:
 * `brainstorm-notes.md` exists only when verify-facts was given `--notes`, so
 * requiring it would refuse a legitimate plan.
 */
export const durablePlanFiles = async ({ cwd, name }: Params): Promise<DurableSet> => {
	const deliverable = await resolvePlanDeliverable({ cwd, name });

	if (deliverable.error !== undefined) {
		return { files: [], error: `nothing to publish for '${name}': ${deliverable.error}` };
	}

	const isSinglePlan = deliverable.files.length === 1 && basename(deliverable.files[0]?.path ?? '') === 'plan.md';

	if (!isSinglePlan && deliverable.overviewPath === undefined) {
		return {
			files: [],
			error: `nothing to publish for '${name}': phase files need an overview.md so the restored folder is a runnable phased plan`,
		};
	}

	const dir = await planWorkspaceDir({ cwd, name });
	const deliverablePaths = deliverable.overviewPath === undefined ? [] : [deliverable.overviewPath];
	// The resolver already sorts the phase files, so the attachment order is the
	// reading order.
	const files: DurablePlanFile[] = [...deliverablePaths, ...deliverable.files.map((file) => file.path)].map((path) => ({ name: basename(path), path }));

	for (const record of durablePlanFileNames.records) {
		const path = join(dir, record);

		if (await pathExists({ path })) {
			files.push({ name: record, path });
		}
	}

	return { files };
};
