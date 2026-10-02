import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { standardsScopeFiles } from '#src/pipeline/internal/common/utils/standardsScopeFiles.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { attributeStandardsFindings } from '#src/standardsCheck/attributeStandardsFindings.ts';
import { runStandardsCheck } from '#src/standardsCheck/runStandardsCheck.ts';
import { selectStandardsFindings } from '#src/standardsCheck/selectStandardsFindings.ts';

interface Params {
	run: PipelineRun;
	/** The pre-edit baseline's findings, or undefined when the run has none. */
	baseline: StandardsFinding[] | undefined;
}

/**
 * Scoped with `standardsScopeFiles` rather than `sourceFiles`, because a finding may be about
 * a test file. `all` is on so the debt ledger suppresses nothing: attribution against the
 * pre-edit baseline does the suppressing instead, so a ledgered file this run grew can qualify.
 */
export const standardsWorkList = async ({
	run,
	baseline,
}: Params): Promise<{
	workList: StandardsFinding[];
	advisories: StandardsFinding[];
	inherited: StandardsFinding[];
	uncertain: StandardsFinding[];
}> => {
	const { findings } = await runStandardsCheck({ cwd: run.cwd, config: run.config, persist: false, all: true });
	const scoped = selectStandardsFindings({ findings, changedFiles: standardsScopeFiles({ run }) });
	const attributed = attributeStandardsFindings({ live: [...scoped.workList, ...scoped.advisories], baseline });
	const qualifying = [...attributed.introduced, ...attributed.worsened];

	return {
		workList: qualifying.filter((finding) => finding.severity === StandardsSeverity.Blocking),
		advisories: qualifying.filter((finding) => finding.severity === StandardsSeverity.Advisory),
		inherited: attributed.inherited,
		uncertain: attributed.uncertain,
	};
};
