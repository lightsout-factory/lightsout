import { basename } from 'node:path';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { planNameFromPath } from '#src/plan/planNameFromPath.ts';

interface Params {
	/** The checkout the run builds in, which the plan path is resolved against. */
	cwd: string;
	/** The plan's address under the plans directory. */
	name: string;
	/** Undefined for a build from the ticket body. */
	planPath: string | undefined;
	pipeline?: PipelineKind;
}

const wholePlanFileNames = ['plan.md', 'overview.md'];

/**
 * Only a whole-plan run may claim a plan implemented or satisfy a ship request.
 * A build from the ticket body counts, as the whole of single-plan plan 001, and
 * so does a `--start-phase` run, which still starts from `overview.md`.
 *
 * Takes a path rather than a manifest because one caller asks before the run exists.
 */
export const isWholePlanRun = async ({ cwd, name, planPath, pipeline }: Params): Promise<boolean> => {
	if (pipeline === PipelineKind.Direct || planPath === undefined) {
		return true;
	}

	const belongsToPlan = (await planNameFromPath({ cwd, planPath })) === name;

	return belongsToPlan && wholePlanFileNames.includes(basename(planPath));
};
