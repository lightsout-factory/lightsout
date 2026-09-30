import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';

export interface CleanupContext {
	run: PipelineRun;
	gitPrefix?: string;
	planContent: string;
	overviewContent?: string;
	standards?: string;
	groups: StandardsGroup[];
	/** The pre-edit baseline's findings, or undefined when the run has none. */
	baseline: StandardsFinding[] | undefined;
	/** How many cleanup executor rounds this run may spend at most. */
	budget: number;
	/** Fingerprints of the standards-scope changed files as cleanup began. */
	before: Record<string, string>;
	/** The judgment reviewer's read before the first round, reused as-is across a resume. */
	initialReview: StandardsFinding[];
}
