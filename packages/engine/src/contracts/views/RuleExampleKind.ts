/** A repo is a small source tree each side, for a rule that looks across files where no single file shows the defect. */
export const RuleExampleKind = {
	Snippet: 'snippet',
	Repo: 'repo',
} as const;

export type RuleExampleKind = (typeof RuleExampleKind)[keyof typeof RuleExampleKind];
