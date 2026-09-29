import { formatFindingSite } from '#src/common/findings/formatFindingSite.ts';
import { formatFindingText } from '#src/common/findings/formatFindingText.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';

interface Params {
	findings: StandardsFinding[];
	report?: WorkReport;
	roundsUsed: number;
}

/**
 * Not an escalation: nothing here stops a run. It names the sites, because a reader who later
 * acts on it needs them rather than opaque keys.
 */
export const describePersistingFindings = ({ findings, report, roundsUsed }: Params): string => {
	const findingLines = findings.map((finding) => {
		const where = finding.files.map((file) => formatFindingSite({ file })).join(', ');

		return `- ${finding.siteKey} — ${formatFindingText({ finding })}\n  at ${where}`;
	});
	const rationale = (report?.friction ?? []).map((entry) => `- [${entry.area}] ${entry.detail}`);

	return [
		`refactor: cleanup ended with ${findings.length} qualifying blocking finding(s) still standing after ${roundsUsed} round(s) — recorded, and the run carries on:`,
		...findingLines,
		...(rationale.length > 0 ? ["the cleanup agent's account of its final round:", ...rationale] : []),
	].join('\n');
};
