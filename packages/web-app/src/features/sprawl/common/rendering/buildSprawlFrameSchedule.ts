import type { SprawlFrame } from '#src/features/sprawl/internal/common/contracts/SprawlFrame.ts';

interface Params {
	frames: SprawlFrame[];
}

/**
 * Refactor markers are held for several ticks: a move is a single commit and
 * would otherwise flash by as a glitch. The page and the README GIF both walk
 * this list, so they hold it for the same count.
 */
export const buildSprawlFrameSchedule = ({ frames }: Params): number[] => {
	const schedule: number[] = [];

	frames.forEach((frame, index) => {
		// A quarter of a second: long enough to see, short enough to keep the replay brief.
		const holds = frame.isRefactorMarker ? 3 : 1;

		for (let hold = 0; hold < holds; hold += 1) {
			schedule.push(index);
		}
	});

	return schedule;
};
