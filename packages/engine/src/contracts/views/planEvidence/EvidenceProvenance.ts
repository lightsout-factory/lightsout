/** Where a figure in a plan's evidence summary came from; a display ticks only a measured one. */
export const EvidenceProvenance = {
	/** The engine itself counted or read it from a deterministic record: git, a gate's exit code, a recorded file. */
	Measured: 'measured',
	/** An agent said so: a reviewer's verdict, a grader's finding, an executor's prior-art search. */
	Reported: 'reported',
} as const;

export type EvidenceProvenance = (typeof EvidenceProvenance)[keyof typeof EvidenceProvenance];
