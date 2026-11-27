import type { ShipResult } from '#src/contracts/ship/ShipResult.ts';
import { EvidenceProvenance } from '#src/contracts/views/planEvidence/EvidenceProvenance.ts';
import { EvidenceSectionState } from '#src/contracts/views/planEvidence/EvidenceSectionState.ts';
import type { PlanEvidence } from '#src/contracts/views/planEvidence/PlanEvidence.ts';
import { buildShippingStepRows } from '#src/ship/progress/buildShippingStepRows.ts';
import { isShippingProgressLive } from '#src/ship/progress/isShippingProgressLive.ts';
import { readShippingProgress } from '#src/ship/progress/readShippingProgress.ts';
import { readShipResult } from '#src/ship/readShipResult.ts';

interface Params {
	cwd: string;
	/** `WorkOrderState.branch`. */
	branch: string;
}

/** The ship result narrowed to what the summary shows. */
const toResult = ({ result }: { result: ShipResult }) => ({
	status: result.status,
	prUrl: result.prUrl,
	mergedAt: result.mergedAt,
	failingChecks: result.failingChecks,
	provenance: EvidenceProvenance.Measured,
});

/**
 * Read by branch, as ship files them, the same way the work order's page reads them. A
 * shipping-progress file that is there and will not read is named, never dropped.
 */
export const buildShipSection = async ({ cwd, branch }: Params): Promise<{ section: PlanEvidence['ship']; problems: string[] }> => {
	const [result, reading] = await Promise.all([readShipResult({ cwd, branch }), readShippingProgress({ cwd, branch })]);
	const { progress } = reading;
	const problems = reading.exists && progress === undefined ? [`the shipping-progress record for ${branch} could not be read`] : [];

	if (result === undefined && progress === undefined) {
		return { section: undefined, problems };
	}

	const live = progress !== undefined && isShippingProgressLive({ progress });
	const rows = progress === undefined ? [] : buildShippingStepRows({ progress, live, nowMs: Date.now() });

	return {
		section: {
			state: live ? EvidenceSectionState.InProgress : EvidenceSectionState.Finished,
			result: result === undefined ? undefined : toResult({ result }),
			steps: rows.map(({ id, status, durationMs }) => ({ id, status, durationMs, provenance: EvidenceProvenance.Measured })),
		},
		problems,
	};
};
