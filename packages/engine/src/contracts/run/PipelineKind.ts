export const PipelineKind = {
	/** What a manifest without the discriminator is read as. */
	Implement: 'implement',
	Refactor: 'refactor',
	/** A coordinator that runs one child run per phase of an overview. */
	Phases: 'phases',
	Coverage: 'coverage',
	/** A coordinator draining a tracker's backlog into parallel worktrees. */
	Queue: 'queue',
	/** One ticket built straight from its body, with the repo's gates as the only bar. */
	Direct: 'direct',
} as const;

export type PipelineKind = (typeof PipelineKind)[keyof typeof PipelineKind];
