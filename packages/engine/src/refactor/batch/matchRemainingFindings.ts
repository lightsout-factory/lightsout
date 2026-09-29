import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';

interface Params {
	frozen: StandardsFinding[];
	live: StandardsFinding[];
}

/**
 * Site key alone is enough: a key is the rule id plus sorted file paths, so no
 * edit above the site can re-mint it with a new line number.
 */
export const matchRemainingFindings = ({ frozen, live }: Params): string[] => {
	const liveSiteKeys = new Set(live.map((finding) => finding.siteKey));

	return frozen.filter((finding) => liveSiteKeys.has(finding.siteKey)).map((finding) => finding.siteKey);
};
