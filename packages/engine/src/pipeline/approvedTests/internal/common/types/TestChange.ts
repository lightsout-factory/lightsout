import type { TestChangeKind } from '#src/pipeline/approvedTests/internal/common/constants/TestChangeKind.ts';

export interface TestChange {
	/** Repo-relative path. */
	path: string;
	kind: TestChangeKind;
	/** Unified diff, approved version to live file. */
	diff: string;
}
