import { stat } from 'node:fs/promises';
import { activityRecordPath } from '#src/activity/activityRecordPath/activityRecordPath.ts';
import { createActivityRecorder } from '#src/activity/createActivityRecorder/createActivityRecorder.ts';
import { messageOf } from '#src/common/messageOf.ts';
import type { ActivityLevel } from '#src/common/types/ActivityLevel.ts';
import { ActivityLevelKind } from '#src/contracts/activity/ActivityLevelKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

interface Params<Result> {
	cwd: string;
	/** Undefined when the caller has no plan folder, which records nothing. */
	name: string | undefined;
	/** Free text: the recorder is handed a label, never a planning enum. */
	label: string;
	/** Handed an undefined level when nothing is being recorded. */
	work: ({ level }: { level: ActivityLevel | undefined }) => Promise<Result>;
	/** Must agree with the exit code the caller then returns. */
	statusOf: ({ result }: { result: Result }) => RunStatus;
}

/**
 * The recorder swallows its own write failures, so looking afterwards is the
 * only way to still tell a human. Every command run writes at least two marks,
 * so a path that is not a file once they settle could not be written to.
 */
const missingRecord = async ({ dir }: { dir: string }) => {
	const path = activityRecordPath({ dir });

	return stat(path)
		.then((found) => (found.isFile() ? undefined : `the activity record at ${path} could not be written: it is not a file`))
		.catch((error: unknown) => `the activity record at ${path} could not be written: ${messageOf({ error })}`);
};

/**
 * The plan level is closed on every command run because no process knows it is
 * the last; the fold's earliest-start and latest-end rules turn that into one
 * plan span. The folder comes from `planWorkspaceDir`, never from the caller,
 * so the record can only land in the main checkout.
 *
 * A caller with no plan name — an implement run on a plan file outside the
 * plans directory — records nothing.
 */
export const recordPlanCommandRun = async <Result>({ cwd, name, label, work, statusOf }: Params<Result>): Promise<Result> => {
	if (name === undefined) {
		return work({ level: undefined });
	}

	const dir = await planWorkspaceDir({ cwd, name });
	const plan = createActivityRecorder({ dir, level: ActivityLevelKind.Plan, label: name });
	const commandRun = plan.open({ level: ActivityLevelKind.CommandRun, label });
	let outcome: RunStatus = RunStatus.Failed;

	try {
		const result = await work({ level: commandRun });

		outcome = statusOf({ result });

		return result;
	} finally {
		commandRun.close({ outcome });
		plan.close({ outcome });
		// Settled so every mark is on disk before the caller reaches `exitCli`.
		await plan.settled();

		const missing = await missingRecord({ dir });

		if (missing !== undefined) {
			console.error(missing);
		}
	}
};
