import { isSourceFile } from '#src/common/sourceFiles/isSourceFile.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';

interface Params {
	run: PipelineRun;
}

/**
 * Tests stay in, unlike `sourceFiles`: the standards gate asks which files a
 * finding may be about, and a finding whose only file is a test would otherwise
 * be unmatchable. Vendored paths stay out because their conventions are not
 * this repo's.
 */
export const standardsScopeFiles = ({ run }: Params): string[] => {
	const vendored = run.config.vendored ?? [];

	return run
		.current()
		.changedFiles.filter(
			(file) => isSourceFile({ path: file, sourceFileGlobs: run.config['source-files'] }) && !vendored.some((prefix) => file.startsWith(prefix)),
		);
};
