import type { GateEvidence } from '#src/contracts/views/GateEvidence.ts';
import { appendRunLog } from '#src/runState/internal/common/utils/appendRunLog.ts';

interface Params {
	cwd: string;
	runId: string;
	/** Taken from `GateEvidence` rather than restated, so the log's line cannot drift from the contract. */
	record: GateEvidence;
}
/**
 * Every command is recorded, passing, failing or skipped: a green gate that
 * leaves no evidence is indistinguishable from a gate that never ran.
 */
export const appendCommandLog = async ({ cwd, runId, record }: Params): Promise<void> => {
	await appendRunLog({ cwd, runId, fileName: 'commands.jsonl', record });
};
