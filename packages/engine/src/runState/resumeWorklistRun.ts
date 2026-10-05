import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { z } from 'zod';
import { formatResumeCommand } from '#src/common/runs/formatResumeCommand.ts';
import { resolveRunDir } from '#src/common/runs/resolveRunDir.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';

interface Params<Contract extends z.ZodType> {
	cwd: string;
	existing: RunManifest;
	/** The pipeline doing the resuming. */
	pipeline: PipelineKind;
	/** The shape of the worklist that pipeline froze into its run folder. */
	contract: Contract;
}

/**
 * Takes over a run that froze a worklist when it started, and answers that worklist.
 *
 * @throws {Error} When the run belongs to another pipeline.
 */
export const resumeWorklistRun = async <Contract extends z.ZodType>({ cwd, existing, pipeline, contract }: Params<Contract>): Promise<z.infer<Contract>> => {
	const recorded = existing.pipeline ?? PipelineKind.Implement;

	if (recorded !== pipeline) {
		const resume = formatResumeCommand({ pipeline: recorded, runId: existing.runId });

		throw new Error(`run ${existing.runId} belongs to the ${recorded} pipeline — resume it with: ${resume}`);
	}

	// Read from the run's own directory rather than by joining the recorded
	// path onto `cwd`: run folders resolve against the primary checkout, so a
	// resume standing in a worktree would open a file that is not there.
	const frozen = join(await resolveRunDir({ cwd, runId: existing.runId }), 'worklist.json');
	const worklist: z.infer<Contract> = contract.parse(JSON.parse(await readFile(frozen, 'utf8')));

	await writeRunOwner({ cwd, runId: existing.runId });

	return worklist;
};
