import { dim } from '#src/cli/common/terminal/dim.ts';
import { green } from '#src/cli/common/terminal/green.ts';
import { red } from '#src/cli/common/terminal/red.ts';
import { yellow } from '#src/cli/common/terminal/yellow.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';

interface Params {
	step: StepRecord;
	/** The agent's own opt-out on this batch — a refactor decline, a set-aside coverage file. */
	optedOut: boolean;
	/** What became of the batch, in the run's own vocabulary. */
	label: string;
}

/** An opt-out is not a failure — the agent looked and said no — so it gets its own icon rather than the red one. */
export const printBatchLine = ({ step, optedOut, label }: Params): void => {
	const icon = step.status !== RunStatus.Passed ? red('✗') : optedOut ? yellow('⤫') : green('✓');

	console.log(`${icon} ${step.id.padEnd(48)}${label}${step.changedFiles?.length ? dim(` · ${step.changedFiles.length} file(s)`) : ''}`);
};
