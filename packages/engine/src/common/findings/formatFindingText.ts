import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';

interface Params {
	finding: StandardsFinding;
}

/**
 * Wherever a finding becomes a single line, the guidance must travel with the
 * detail: it is where a rule says what it cannot judge for itself.
 */
export const formatFindingText = ({ finding }: Params): string => (finding.guidance ? `${finding.detail} — ${finding.guidance}` : finding.detail);
