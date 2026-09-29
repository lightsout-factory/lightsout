import { readdir } from 'node:fs/promises';
import { formatPlanAddress } from '#src/common/planAddress/formatPlanAddress.ts';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

interface Params {
	cwd: string;
	/** The --plan value exactly as the user gave it. */
	name: string;
}

/**
 * What a `--plan` value addresses: one plan, or every plan of a ticket folder.
 *
 * Two answers. A name that parses as a plan address and whose folder is there is
 * that one plan. A work order name whose plans folder holds plan subfolders
 * contributes every plan's address in plan-id order — a ticket's plans are the
 * unit a person paid for, so asking what a ticket cost must not need several
 * commands and hand arithmetic.
 *
 * Anything else answers an error naming the value and the folder that was
 * searched, so a reader can see which checkout answered. It never exits and
 * never prints: the command owns the exit code and the output.
 *
 * It asks `parsePlanAddress` for the address shape rather than splitting a name
 * itself, which is the rule that function's own doc comment sets. It is not
 * `resolvePlanTarget`, which answers which deliverable file inside a folder a
 * run should build from — a different question.
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
