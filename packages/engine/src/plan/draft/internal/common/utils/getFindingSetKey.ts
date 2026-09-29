import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { getBlockingFindings } from '#src/plan/common/utils/getBlockingFindings.ts';

interface Params {
	findings: StructuralFinding[];
}

/**
 * `location` is deliberately excluded: it carries a line number, and a repair
 * edit earlier in the file shifts every later finding's line — a stuck finding
 * that merely drifted would read as progress.
 */
export const getFindingSetKey = ({ findings }: Params): string =>
	getBlockingFindings({ findings })
		.map((finding) => [finding.check, finding.issue].join('|'))
		.sort()
		.join('\n');
