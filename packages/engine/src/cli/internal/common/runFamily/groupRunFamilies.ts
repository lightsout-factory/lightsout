import { getRunFamilyRoot } from '#src/cli/internal/common/runFamily/getRunFamilyRoot.ts';
import type { RunFamily } from '#src/cli/internal/common/types/RunFamily.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';

interface Params {
	runs: RunListing[];
}

/**
 * A phased plan has two live manifests at once — the coordinator and its phase
 * child — and counting those as two runs would call every phased run ambiguous.
 */
export const groupRunFamilies = ({ runs }: Params): RunFamily[] => {
	const families = new Map<string, RunListing[]>();

	for (const run of runs) {
		const root = getRunFamilyRoot({ run });

		families.set(root, [...(families.get(root) ?? []), run]);
	}

	return [...families].map(([root, grouped]) => ({ root, runs: grouped }));
};
