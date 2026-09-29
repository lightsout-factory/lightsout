import { relative } from 'node:path';
import type { CommandResult } from '#src/common/types/CommandResult.ts';
import type { GateResult } from '#src/contracts/gates/GateResult.ts';

interface Params {
	cwd: string;
	kind: string;
	group: string;
	command: string;
	result: CommandResult;
	durationMs: number;
	crashed: boolean;
	timedOut: boolean;
	rerun?: boolean;
	/** Absolute; recorded relative to the checkout. Absent for a run with no run folder. */
	evidenceDir?: string;
}

/** Built once for both sinks, so commands.jsonl and the result cannot drift. */
export const buildGateResult = ({ cwd, kind, group, command, result, durationMs, crashed, timedOut, rerun, evidenceDir }: Params): GateResult => {
	const outputTailChars = 2000;

	return {
		kind,
		group,
		command,
		exitCode: result.exitCode,
		durationMs,
		...(rerun ? { rerun: true } : {}),
		...(crashed ? { crashed: true } : {}),
		...(timedOut ? { timedOut: true } : {}),
		...(evidenceDir ? { testResultsDir: relative(cwd, evidenceDir) } : {}),
		...(result.exitCode === 0 ? {} : { outputTail: `${result.stdout}\n${result.stderr}`.slice(-outputTailChars) }),
	};
};
