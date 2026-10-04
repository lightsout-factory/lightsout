import { rm } from 'node:fs/promises';
import { pathExists } from '#src/common/pathExists.ts';

/**
 * Not tidiness: `resolvePlanDeliverable` short-circuits on `plan.md` existing,
 * so a surviving single draft would shadow the phased plan entirely.
 *
 * @returns `undefined` once the path is gone, and otherwise the reason it is not.
 */
export const deleteAbandonedPlan = async ({ path }: { path: string }): Promise<string | undefined> => {
	await rm(path, { force: true }).catch(() => undefined);

	return (await pathExists({ path })) ? `the abandoned single draft could not be deleted at ${path}` : undefined;
};
