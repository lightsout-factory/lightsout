import type { HarnessProcessMark } from '#src/contracts/activity/HarnessProcessMark.ts';

interface Params {
	process: HarnessProcessMark;
}

/**
 * The tree's leaf rows and the outlier section both spell a process through
 * this one function, because a reader matches an outlier line to its row by
 * that spelling.
 */
export const harnessProcessLabel = ({ process }: Params): string =>
	[process.harness, ...(process.model === undefined ? [] : [process.model]), ...(process.effort === undefined ? [] : [process.effort])].join(' · ');
