import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { AttributedFindings } from '#src/standardsCheck/attributeStandardsFindings/AttributedFindings.ts';

interface Params {
	/** The live check's findings, already filtered to the run's changed files. */
	live: StandardsFinding[];
	/** The pre-edit baseline's findings, or undefined when the run has none. */
	baseline: StandardsFinding[] | undefined;
}

/**
 * Matched on site key, which carries no line number, so an edit above a site
 * cannot re-mint the key and make an untouched finding read as introduced.
 *
 * A one-sided `measure` — and every finding when the run has no baseline — is
 * an absence of evidence, not evidence of growth, so it lands in `uncertain`.
 * Only `introduced` and `worsened` are ever handed back as work.
 */
export const attributeStandardsFindings = ({ live, baseline }: Params): AttributedFindings => {
	const attributed: AttributedFindings = { introduced: [], worsened: [], inherited: [], uncertain: [] };

	if (baseline === undefined) {
		return { ...attributed, uncertain: [...live] };
	}

	const before = new Map(baseline.map((finding) => [finding.siteKey, finding]));

	for (const finding of live) {
		const previous = before.get(finding.siteKey);

		if (previous === undefined) {
			attributed.introduced.push(finding);
		} else if (finding.measure === undefined || previous.measure === undefined) {
			attributed.uncertain.push(finding);
		} else if (finding.measure > previous.measure) {
			attributed.worsened.push(finding);
		} else {
			attributed.inherited.push(finding);
		}
	}

	return attributed;
};
