import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import { messageOf } from '#src/common/messageOf.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { resolvePlanDeliverable } from '#src/plan/common/utils/resolvePlanDeliverable.ts';
import { readMergedDecisions } from '#src/plan/decisionLog/readMergedDecisions.ts';
import type { DeliverableFile } from '#src/plan/internal/common/types/DeliverableFile.ts';

interface Params {
	cwd: string;
	name: string;
}

interface PlanDetectionInputs {
	overviewText?: string;
	/** Overview excluded. */
	files: DeliverableFile[];
	/** Overview included. */
	planPaths: string[];
	decisions: DecisionsRecord;
	config?: LightsoutConfig;
	error?: string;
}

/**
 * A missing or unreadable `decisions.json` is an error rather than a skipped
 * comparison: a check whose input can be deleted is a check that can be
 * switched off.
 */
export const getPlanDetectionInputs = async ({ cwd, name }: Params): Promise<PlanDetectionInputs> => {
	const deliverable = await resolvePlanDeliverable({ cwd, name });
	const empty: DecisionsRecord = { planName: name, decisions: [] };

	if (deliverable.error) {
		return { files: [], planPaths: [], decisions: empty, error: deliverable.error };
	}

	const { overviewPath, overviewText, files } = deliverable;
	const planPaths = [...(overviewPath ? [overviewPath] : []), ...files.map((file) => file.path)];
	const config = await readOptionalConfig({ cwd });
	const merged = await readMergedDecisions({ cwd, name }).catch((error: unknown) => messageOf({ error }));

	return typeof merged === 'string'
		? { overviewText, files, planPaths, decisions: empty, config, error: merged }
		: { overviewText, files, planPaths, decisions: merged.merged, config };
};
