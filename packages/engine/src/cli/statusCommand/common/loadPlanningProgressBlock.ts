import { formatClockDuration } from '#src/cli/common/formatClockDuration.ts';
import { renderProgressBlock } from '#src/cli/statusCommand/common/renderProgressBlock.ts';
import type { PlanningProgress } from '#src/contracts/plan/progress/PlanningProgress.ts';
import { PlanningStep } from '#src/contracts/plan/progress/PlanningStep.ts';
import type { PlanningStepRecord } from '#src/contracts/plan/progress/PlanningStepRecord.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { pathExists } from '#src/plan/common/paths/pathExists.ts';
import { getPlanningProgressPath } from '#src/plan/progress/getPlanningProgressPath.ts';
import { readPlanningProgress } from '#src/plan/progress/readPlanningProgress.ts';
import { isPidAlive } from '#src/runState/isPidAlive.ts';

/** Local time, because a reader compares it against the clock on their own screen. */
const localClock = ({ iso }: { iso: string }) => {
	const at = new Date(iso);

	return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
};

/** Newest start first, so a tie between two running entries goes to the one that started last. */
const splitRunning = ({ steps }: { steps: PlanningStepRecord[] }) => {
	const running = steps.filter((entry) => entry.status === RunStatus.Running).sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
	const live: PlanningStepRecord[] = [];
	const dead: PlanningStepRecord[] = [];

	for (const entry of running) {
		(isPidAlive({ pid: entry.pid }) ? live : dead).push(entry);
	}

	return { live, dead };
};

/**
 * A running entry whose recording process is gone is drawn failed with no
 * clock: it can no longer finish, and drawing it running would make a crashed
 * plan look busy.
 */
const planningRows = ({ steps, live, nowMs }: { steps: PlanningStepRecord[]; live: PlanningStepRecord[]; nowMs: number }) =>
	Object.values(PlanningStep).map((step) => {
		const entry = steps.find((candidate) => candidate.step === step);

		if (entry === undefined) {
			return { id: step, status: undefined, attempts: 0, durationMs: undefined };
		}

		let status = entry.status;
		let durationMs = entry.durationMs;

		if (entry.status === RunStatus.Running) {
			const isLive = live.includes(entry);

			status = isLive ? RunStatus.Running : RunStatus.Failed;
			durationMs = isLive ? nowMs - Date.parse(entry.startedAt) : undefined;
		}

		return { id: step, status, attempts: entry.attempts, durationMs };
	});

/** Measured from the first step's start, because the time between steps is real planning time. */
const planningTotals = ({
	progress,
	live,
	dead,
	passed,
	nowMs,
}: {
	progress: PlanningProgress;
	live: PlanningStepRecord[];
	dead: PlanningStepRecord[];
	passed: number;
	nowMs: number;
}) => {
	const starts = progress.steps.map((entry) => Date.parse(entry.startedAt));
	const finishes = progress.steps.flatMap((entry) => (entry.finishedAt === undefined ? [] : [Date.parse(entry.finishedAt)]));
	const end = live.length > 0 ? nowMs : dead.length > 0 ? Date.parse(progress.updatedAt) : Math.max(...finishes);
	const elapsedMs = starts.length === 0 ? 0 : Math.max(0, end - Math.min(...starts));

	return `elapsed ${formatClockDuration({ ms: elapsedMs })} · ${passed} of ${Object.values(PlanningStep).length} passed`;
};

const planningNow = ({ progress, live, dead }: { progress: PlanningProgress; live: PlanningStepRecord[]; dead: PlanningStepRecord[] }) => {
	// A running entry has no finish time, so a step whose process is gone never counts as the one that finished last.
	const [lastFinished] = progress.steps
		.flatMap((entry) => (entry.status === RunStatus.Running || entry.finishedAt === undefined ? [] : [{ entry, finishedAt: entry.finishedAt }]))
		.sort((left, right) => Date.parse(right.finishedAt) - Date.parse(left.finishedAt));
	let text = 'no step has run yet';

	if (live[0] !== undefined) {
		text = `${live[0].step} running since ${localClock({ iso: live[0].startedAt })}`;
	} else if (dead[0] !== undefined) {
		text = `${dead[0].step} — no live process is recording it · last update ${localClock({ iso: progress.updatedAt })}`;
	} else if (lastFinished !== undefined) {
		text = `${lastFinished.entry.step} ${lastFinished.entry.status} at ${localClock({ iso: lastFinished.finishedAt })}`;
	}

	return text;
};

interface Params {
	cwd: string;
	/** Kebab plan name — the plan folder the record lives in. */
	name: string;
}

/** The clock is read once, so every time the block shows agrees with every other. */
export const loadPlanningProgressBlock = async ({ cwd, name }: Params): Promise<string[]> => {
	const recordPath = await getPlanningProgressPath({ cwd, name });
	const nowMs = Date.now();
	// A missing record reads as an empty one; a record that is there but cannot be used is `undefined`.
	const progress: PlanningProgress | undefined = (await pathExists({ path: recordPath }))
		? await readPlanningProgress({ cwd, name })
		: { name, updatedAt: new Date(nowMs).toISOString(), steps: [] };

	if (progress === undefined) {
		return [`the planning record ${recordPath} could not be read`];
	}

	const { live, dead } = splitRunning({ steps: progress.steps });
	const rows = planningRows({ steps: progress.steps, live, nowMs });
	const passed = rows.filter((row) => row.status === RunStatus.Passed).length;

	return renderProgressBlock({
		title: name,
		tag: 'planning',
		rows,
		diagnostics: [],
		totals: planningTotals({ progress, live, dead, passed, nowMs }),
		now: planningNow({ progress, live, dead }),
	});
};
