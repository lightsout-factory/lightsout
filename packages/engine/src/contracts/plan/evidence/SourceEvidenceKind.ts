/**
 * `Missing` is load-bearing: `verifyFacts` never checks an integration point's
 * `at` location, so verified facts can still name a path that is not there, and
 * that is recorded rather than aborting the draft.
 */
export const SourceEvidenceKind = {
	/** The file's full text, verbatim. */
	Whole: 'whole',
	/** Selected whole definitions from a file too large to carry in full. */
	Definitions: 'definitions',
	/** The facts named this path and nothing was on disk at it. */
	Missing: 'missing',
} as const;

export type SourceEvidenceKind = (typeof SourceEvidenceKind)[keyof typeof SourceEvidenceKind];
