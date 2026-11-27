import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';

interface Params {
	/** The findings already recorded as handed to cleanup. */
	targeted: StandardsFinding[];
	/** The work list about to be handed to a round. */
	findings: StandardsFinding[];
}

/** A new list: `targeted` unchanged, then each finding whose `siteKey` neither `targeted` nor an earlier finding holds. */
export const addTargetedFindings = ({ targeted, findings }: Params): StandardsFinding[] => {
	const seen = new Set(targeted.map((finding) => finding.siteKey));
	const added: StandardsFinding[] = [];

	for (const finding of findings) {
		if (!seen.has(finding.siteKey)) {
			seen.add(finding.siteKey);
			added.push(finding);
		}
	}

	return [...targeted, ...added];
};
