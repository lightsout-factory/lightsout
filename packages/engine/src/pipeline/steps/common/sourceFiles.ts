import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import { standardsScopeFiles } from '#src/pipeline/steps/common/standardsScopeFiles.ts';

interface Params {
	run: PipelineRun;
}

/**
 * One filter on top of `standardsScopeFiles` rather than a copy of its
 * conditions, so the two lists cannot drift. Dropping tests is right for every
 * caller here and wrong for the standards gate, which reads the wider list.
 */
export const sourceFiles = ({ run }: Params): string[] => standardsScopeFiles({ run }).filter((file) => !isTestFile({ path: file }));
