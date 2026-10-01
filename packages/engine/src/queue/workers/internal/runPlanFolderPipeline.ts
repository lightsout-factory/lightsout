import { join } from 'node:path';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { runPhasesPipeline } from '#src/phases/runPhasesPipeline.ts';
import { runImplementPipeline } from '#src/pipeline/runImplementPipeline.ts';
import { pathExists } from '#src/plan/common/paths/pathExists.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { recordPlanCommandRun } from '#src/plan/progress/recordPlanCommandRun.ts';
import type { WorkerOutcome } from '#src/queue/internal/common/types/WorkerOutcome.ts';
import { toWorkerOutcome } from '#src/queue/workers/internal/common/utils/toWorkerOutcome.ts';
import { runWorkOrderPlanLifecycle } from '#src/workOrder/implementRun/runWorkOrderPlanLifecycle.ts';

interface Params {
	/** The worktree the pipeline runs in. The plan folder is resolved from `name` under the primary checkout, not read from this worktree. */
	cwd: string;
	/** The plan's address, `<ticket-branch>/<plan-id>`, or the branch-named folder of a ticket with no record. */
	name: string;
	config: LightsoutConfig;
	driver: Driver;
	onProgress?: (message: string) => void;
}

/**
 * Labelled `implement`, the same word a hand-typed `lightsout implement`
 * records, because it is the same build.
 *
 * It never relays a question: the implement pipelines have no answer channel,
 * so an escalated run parks with its worktree intact instead.
 */
export const runPlanFolderPipeline = async ({ cwd, name, config, driver, onProgress }: Params): Promise<WorkerOutcome> => {
	const folder = await planWorkspaceDir({ cwd, name });
	const overviewPath = join(folder, 'overview.md');
	const phased = await pathExists({ path: overviewPath });
	const outcome = await runWorkOrderPlanLifecycle({
		cwd,
		name,
		run: ({ runId }) =>
			recordPlanCommandRun({
				cwd,
				name,
				label: 'implement',
				statusOf: ({ result }) => result.manifest.status,
				work: ({ level }) =>
					phased
						? runPhasesPipeline({ cwd, driver, config, overviewPath, runId, level, onProgress })
						: runImplementPipeline({ cwd, driver, config, planPath: join(folder, 'plan.md'), runId, level, onProgress }),
			}),
	});

	return toWorkerOutcome({
		outcome,
		onFailedRun: ({ stated, result }) => ({ error: `${stated} — \`lightsout resume --run ${result.manifest.runId}\` continues it from the worktree` }),
	});
};
