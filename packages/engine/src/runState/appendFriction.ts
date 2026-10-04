import { appendJsonlRecords } from '#src/common/appendJsonlRecords.ts';
import type { FrictionEntry } from '#src/contracts/friction/FrictionEntry/FrictionEntry.ts';
import { FrictionRecord } from '#src/contracts/friction/FrictionRecord.ts';
import { getFrictionPath } from '#src/runState/common/getFrictionPath.ts';

interface Params {
	/** The checkout the run works in — a linked worktree during an isolated run; the primary is resolved from it. */
	cwd: string;
	runId: string;
	step: string;
	friction: FrictionEntry[];
}

/**
 * One append-only ledger per repository, in the primary checkout: friction
 * accumulating across runs is what lets the improvement loop see systemic
 * patterns, and it keeps an isolated run's entries in the same ledger.
 */
export const appendFriction = async ({ cwd, runId, step, friction }: Params): Promise<void> =>
	appendJsonlRecords({ path: await getFrictionPath({ cwd }), schema: FrictionRecord, entries: friction, runId, step });
