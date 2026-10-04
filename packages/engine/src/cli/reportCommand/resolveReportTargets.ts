import { readdir } from 'node:fs/promises';
import { formatPlanAddress } from '#src/common/planAddress/formatPlanAddress.ts';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress/parsePlanAddress.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

interface Params {
	cwd: string;
	/** The --plan value exactly as the user gave it. */
	name: string;
}

/**
 * What a `--plan` value addresses: one plan, or every plan of a ticket folder.
 * The error names the folder searched, so a reader can see which checkout
 * answered.
 */
export const resolveReportTargets = async ({ cwd, name }: Params): Promise<{ names: string[]; workOrderFolder: boolean } | { error: string }> => {
	const folder = await planWorkspaceDir({ cwd, name });
	const children = await readdir(folder, { withFileTypes: true }).catch(() => undefined);

	if (children === undefined) {
		return { error: `no plan folder named '${name}' under ${folder}` };
	}

	const plans = children
		.filter((child) => child.isDirectory())
		.map((child) => formatPlanAddress({ workOrderName: name, planId: child.name }))
		.filter((address) => parsePlanAddress({ name: address }) !== undefined)
		.sort();

	// An addressed name is one plan whatever it happens to hold, so a plan folder
	// that grew a subdirectory of its own is never read as a ticket.
	if (parsePlanAddress({ name }) !== undefined) {
		return { names: [name], workOrderFolder: false };
	}

	return plans.length === 0 ? { error: `work order '${name}' holds no plan under ${folder}` } : { names: plans, workOrderFolder: true };
};
