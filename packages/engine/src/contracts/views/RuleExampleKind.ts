/**
 * How a rule's examples are shaped, and so how a page shows them: a snippet is
 * one file each side, read on its own; a repo is a small source tree each side,
 * because the rule looks across files and no single file shows the defect.
 */
export const RuleExampleKind = {
	Snippet: 'snippet',
	Repo: 'repo',
} as const;

export type RuleExampleKind = (typeof RuleExampleKind)[keyof typeof RuleExampleKind];
