/**
 * A phased plan keeps one log in its overview. The overview is a bare file name,
 * not a backticked path, because a path in a plan file is a claim about the
 * working tree.
 */
export const decisionLogReference = (): string =>
	`## Decision Log

Composed by \`lightsout plan sync-decisions\`. Do not edit by hand. The complete
decision history for every phase of this plan is the log in overview.md, beside
this file.`;
