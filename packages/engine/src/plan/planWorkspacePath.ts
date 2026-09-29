import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress.ts';

interface Params {
	/** A plan address, or a work order's name for its plans folder as a whole. */
	name: string;
}

/**
 * Repo-relative with forward slashes on every platform: the spelling a run
 * manifest's `plan` field carries and `getPlanDocument` takes. It names the
 * folder `planWorkspaceDir` resolves, and the two spell the layout's segments
 * together rather than through a constant neither would be the only reader of.
 */
export const planWorkspacePath = ({ name }: Params): string => {
	const address = parsePlanAddress({ name });
	const plansFolder = `.lightsout/work-orders/${address?.workOrderName ?? name}/plans`;

	return address === undefined ? plansFolder : `${plansFolder}/${address.planId}`;
};
