interface Params {
	stepId: string;
	/** The coordination reason `runGates` answered with — who holds the machine, in which worktree, and for how long it has held it. */
	coordination: string;
}

/**
 * Shared because the implement pipeline and the direct run both end on this
 * condition through different run types, and must tell an operator the same
 * thing about the same machine.
 */
export const describeGateCoordinationStop = ({ stepId, coordination }: Params): string =>
	[
		`${stepId}: the gates never started — another gate run of this repository held the machine, so nothing here was judged.`,
		'No fix was attempted and no fix attempt was spent. The worktree and every commit in it are untouched, so this work resumes where it stopped once the machine is free.',
		coordination,
	].join('\n\n');
