import { join } from 'node:path';
import { resolveRunDir } from '#src/common/runs/resolveRunDir.ts';

/**
 * A package group is a directory name and a custom gate kind is a config key,
 * so neither is guaranteed to be safe as a path segment.
 */
const unsafeSegmentCharacters = /[^A-Za-z0-9._-]/g;

const safeSegment = ({ segment }: { segment: string }) => segment.replace(unsafeSegmentCharacters, '-');

interface Params {
	cwd: string;
	runId: string;
	step: string;
	/** 'root' or the package directory name. */
	group: string;
	/** The gate family, as `GateResult.kind` records it. */
	kind: string;
}

/**
 * One directory per execution, so a checkpoint reads exactly the evidence the gate it observed
 * wrote, never a sibling gate's or an earlier attempt's.
 */
export const testResultsDir = async ({ cwd, runId, step, group, kind }: Params): Promise<string> => {
	const runDir = await resolveRunDir({ cwd, runId });

	return join(runDir, 'test-results', safeSegment({ segment: step }), safeSegment({ segment: group }), safeSegment({ segment: kind }));
};
