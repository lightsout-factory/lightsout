import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

interface Params {
	/** What the work set out to leave standing — the run's frozen work-list, or a batch's pre-edit review. */
	frozen: StandardsFinding[];
	/** The re-check taken after the work landed. */
	live: StandardsFinding[];
	/** Which severity is being compared: blocking at the run's close, advisory at a batch's. */
	severity: StandardsSeverity;
}

/**
 * A frozen finding still standing is a decline, a judgment the human rules on.
 * One that was not frozen is different in kind: the work made it, and calling
 * that a pass teaches the gate to lie. The severity is a parameter because the
 * run's close asks this of blocking findings and a batch of advisory ones; the
 * consequence belongs to the caller. Matching on site key, which carries no
 * line numbers, keeps an edit above a site from making an untouched finding
 * look introduced.
 */
export const findIntroducedFindings = ({ frozen, live, severity }: Params): StandardsFinding[] => {
	const frozenSiteKeys = new Set(frozen.map((finding) => finding.siteKey));

	return live.filter((finding) => finding.severity === severity && !frozenSiteKeys.has(finding.siteKey));
};
