import type { StandardsPackListing } from '#src/contracts/views/StandardsPackListing.ts';
import { toStandardsPackListing } from '#src/views/common/utils/toStandardsPackListing.ts';
import { listStandardsPackBundles } from '#src/views/internal/listStandardsPackBundles.ts';

interface Params {
	cwd: string;
}

/** Never throws: a repo with no loadable pack answers an empty list, and the reason goes to the server log. */
export const listStandardsPacks = async ({ cwd }: Params): Promise<StandardsPackListing[]> => {
	const bundles = await listStandardsPackBundles({ cwd });

	return bundles.map((bundle) => toStandardsPackListing({ bundle }));
};
