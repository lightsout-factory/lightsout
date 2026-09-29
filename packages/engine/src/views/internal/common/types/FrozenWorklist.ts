import type { CoverageWorklist } from '#src/contracts/coverage/CoverageWorklist.ts';
import type { RefactorWorklist } from '#src/contracts/refactor/RefactorWorklist.ts';
import type { PipelineKind } from '#src/contracts/run/PipelineKind.ts';

interface FrozenRefactorWorklist {
	kind: typeof PipelineKind.Refactor;
	worklist?: RefactorWorklist;
}

interface FrozenCoverageWorklist {
	kind: typeof PipelineKind.Coverage;
	worklist?: CoverageWorklist;
}

/**
 * The two pipelines share a path and filename on disk, so the tag is the only
 * thing that tells them apart. The payload is optional because the kind comes
 * from the manifest before the file is read, so a corrupt coverage work-list is
 * still known to be a coverage run rather than read as a refactor.
 */
export type FrozenWorklist = FrozenRefactorWorklist | FrozenCoverageWorklist;
