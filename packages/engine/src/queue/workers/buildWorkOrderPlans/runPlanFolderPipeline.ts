import { join } from 'node:path';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { runPhasesPipeline } from '#src/phases/runPhasesPipeline/runPhasesPipeline.ts';
import { runImplementPipeline } from '#src/pipeline/runImplementPipeline/runImplementPipeline.ts';
import { pathExists } from '#src/plan/common/paths/pathExists.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { recordPlanCommandRun } from '#src/plan/progress/recordPlanCommandRun.ts';
import type { WorkerOutcome } from '#src/queue/common/types/WorkerOutcome.ts';
import { toWorkerOutcome } from '#src/queue/workers/common/toWorkerOutcome.ts';
import { removeRunOwner } from '#src/runState/owner/removeRunOwner.ts';
import { runWorkOrderPlanLifecycle } from '#src/workOrder/implementRun/runWorkOrderPlanLifecycle.ts';

interface Params {
	/** The worktree the pipeline runs in. The plan folder is resolved from `name` under the primary checkout, not read from this worktree. */
	cwd: string;
	/** The plan's address, `<ticket-branch>/<plan-id>`, or the branch-named folder of a ticket with no record. */
	name: string;
	config: LightsoutConfig;
	/** The queue's startup config as it was read from disk, and its path, recorded on the run this builds. */
	loadedConfig: LoadedConfig;
	driver: Driver;
	onProgress?: (message: string) => void;
	/** The queue run this build belongs to; the run's owner record points there until the build settles. */
	queueRunId: string;
}

/**
 * Labelled `implement`, the same word a hand-typed `lightsout implement`
 * records, because it is the same build.
 *
 * It never relays a question: the implement pipelines have no answer channel,
 * so an escalated run parks with its worktree intact instead.
 */
export const runPlanFolderPipeline = async ({ cwd, name, config, loadedConfig, driver, onProgress, queueRunId }: Params): Promise<WorkerOutcome> => {
	const folder = await planWorkspaceDir({ cwd, name });
	const overviewPath = join(folder, 'overview.md');
	const phased = await pathExists({ path: overviewPath });
	const outcome = await runWorkOrderPlanLifecycle({
		cwd,
		name,
		run: async ({ runId }) => {
			// A settled worker run must stop pointing at the queue, which keeps running.
			try {
				return await recordPlanCommandRun({
					cwd,
					name,
					label: 'implement',
					statusOf: ({ result }) => result.manifest.status,
					work: ({ level }) =>
						phased
							? runPhasesPipeline({ cwd, driver, config, loadedConfig, overviewPath, runId, level, onProgress, queueRunId })
							: runImplementPipeline({ cwd, driver, config, loadedConfig, planPath: join(folder, 'plan.md'), runId, level, onProgress, queueRunId }),
				});
			} finally {
				await removeRunOwner({ cwd, runId });
			}
		},
	});

	return toWorkerOutcome({
		outcome,
		onFailedRun: ({ stated, result }) => ({ error: `${stated} — \`lightsout resume --run ${result.manifest.runId}\` continues it from the worktree` }),
	});
};
