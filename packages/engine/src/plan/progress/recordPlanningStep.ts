import { messageOf } from '#src/common/utils/messageOf.ts';
import type { PlanningProgress } from '#src/contracts/plan/progress/PlanningProgress.ts';
import { PlanningStep } from '#src/contracts/plan/progress/PlanningStep.ts';
import type { PlanningStepRecord } from '#src/contracts/plan/progress/PlanningStepRecord.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { getPlanningProgressPath } from '#src/plan/progress/getPlanningProgressPath.ts';
import { writePlanningProgress } from '#src/plan/progress/internal/common/utils/writePlanningProgress.ts';
import { readPlanningProgress } from '#src/plan/progress/readPlanningProgress.ts';

const withEntry = ({ progress, entry }: { progress: PlanningProgress | undefined; entry: PlanningStepRecord }) => {
	const order = Object.values(PlanningStep);
	const others = progress?.steps.filter((candidate) => candidate.step !== entry.step) ?? [];

	return [...others, entry].sort((left, right) => order.indexOf(left.step) - order.indexOf(right.step));
};

/** A failed write is one stderr line: the planning work must not fail over a reader's convenience. */
const recordEntry = async ({
	cwd,
	name,
	step,
	entryOf,
}: {
	cwd: string;
	name: string;
	step: PlanningStep;
	entryOf: ({ previous }: { previous: PlanningStepRecord | undefined }) => PlanningStepRecord;
}) => {
	const current = await readPlanningProgress({ cwd, name });
	const entry = entryOf({ previous: current?.steps.find((candidate) => candidate.step === step) });
	const progress: PlanningProgress = { name, updatedAt: new Date().toISOString(), steps: withEntry({ progress: current, entry }) };

	await writePlanningProgress({ cwd, progress }).catch(async (error: unknown) => {
		console.error(`the planning progress record at ${await getPlanningProgressPath({ cwd, name })} could not be written: ${messageOf({ error })}`);
	});

	return entry;
};

interface Params<Result> {
	cwd: string;
	name: string;
	step: PlanningStep;
	work: () => Promise<Result>;
	/** Must agree with the exit code the caller then returns. */
	statusOf: ({ result }: { result: Result }) => RunStatus;
}

/**
 * The finish is awaited so the record lands before the caller reaches
 * `exitCli`. There is no lock: plan subcommands on one plan folder run one at a
 * time, and a lock would add a failure path for a record only a reader uses.
 */
export const recordPlanningStep = async <Result>({ cwd, name, step, work, statusOf }: Params<Result>): Promise<Result> => {
	const started = await recordEntry({
		cwd,
		name,
		step,
		entryOf: ({ previous }) => ({
			step,
			status: RunStatus.Running,
			attempts: (previous?.attempts ?? 0) + 1,
			pid: process.pid,
			startedAt: new Date().toISOString(),
		}),
	});
	let status: RunStatus = RunStatus.Failed;

	try {
		const result = await work();

		status = statusOf({ result });

		return result;
	} finally {
		const finishedAt = new Date();

		await recordEntry({
			cwd,
			name,
			step,
			entryOf: () => ({
				...started,
				status,
				finishedAt: finishedAt.toISOString(),
				durationMs: Math.max(0, finishedAt.getTime() - Date.parse(started.startedAt)),
			}),
		});
	}
};
