import { formatClockDuration } from '#src/cli/statusCommand/common/formatClockDuration.ts';
import { localClock } from '#src/cli/statusCommand/common/localClock.ts';
import { renderProgressBlock } from '#src/cli/statusCommand/common/renderProgressBlock.ts';
import type { ShippingProgressReading } from '#src/common/types/ShippingProgressReading.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { buildShippingStepRows } from '#src/ship/progress/buildShippingStepRows.ts';
import { isShippingProgressLive } from '#src/ship/progress/isShippingProgressLive.ts';
import { readShippingProgress } from '#src/ship/progress/readShippingProgress.ts';

type RecordedProgress = ShippingProgressReading['progress'];

const shippingElapsedMs = ({ progress, live, nowMs }: { progress: RecordedProgress; live: boolean; nowMs: number }) => {
	if (progress === undefined) {
		return 0;
	}

	const endMs = progress.endedAt !== undefined ? Date.parse(progress.endedAt) : live ? nowMs : Date.parse(progress.updatedAt);

	return Math.max(0, endMs - Date.parse(progress.startedAt));
};

/** The line that keeps a stopped ship's failed row from reading as a real failure — a red `checks` row would otherwise read as red CI. */
const noLiveProcessLine = ({ progress }: { progress: NonNullable<RecordedProgress> }) => {
	const running = progress.steps.find((step) => step.status === RunStatus.Running);
	const subject = running === undefined ? 'this ship' : running.id;

	return ` no live process is recording ${subject} · last update ${localClock({ iso: progress.updatedAt })}`;
};

interface Params {
	/** The checkout that ships the branch. */
	cwd: string;
	/** The branch as git names it. */
	branch: string;
}

/**
 * Liveness is judged by the end stamp first and the recorded pid second, so a
 * finished ship reads as finished whatever became of its process. The clock is
 * read once, so every time the block shows agrees with every other.
 */
export const loadShippingProgressBlock = async ({ cwd, branch }: Params): Promise<string[]> => {
	const nowMs = Date.now();
	const { path, exists, progress } = await readShippingProgress({ cwd, branch });

	if (path === undefined) {
		return [`${branch} keeps no local shipping record — no work order's record stores that branch`];
	}

	if (exists && progress === undefined) {
		return [`the shipping record ${path} could not be read`];
	}

	const unended = progress !== undefined && progress.endedAt === undefined;
	const live = progress !== undefined && isShippingProgressLive({ progress });
	const lastProgress = progress?.lastProgress?.replace(/\s+/g, ' ').trim();

	return renderProgressBlock({
		title: branch,
		tag: progress === undefined ? 'no attempt yet' : `attempt ${progress.attempt} of ${progress.maxAttempts}`,
		rows: buildShippingStepRows({ progress, live, nowMs }),
		diagnostics: unended && !live ? [noLiveProcessLine({ progress })] : [],
		totals: `elapsed ${formatClockDuration({ ms: shippingElapsedMs({ progress, live, nowMs }) })}`,
		now: progress === undefined ? 'no step has run yet' : lastProgress === '' ? undefined : lastProgress,
	});
};
