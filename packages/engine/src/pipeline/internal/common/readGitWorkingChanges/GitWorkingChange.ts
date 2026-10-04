import type { GitChangeKind } from '#src/pipeline/internal/common/constants/GitChangeKind.ts';

export interface GitWorkingChange {
	/** Relative to the `cwd` the reader was given, with a nested consumer's prefix stripped. */
	path: string;
	kind: GitChangeKind;
}
