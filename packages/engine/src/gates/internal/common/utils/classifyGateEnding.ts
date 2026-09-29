import type { CommandResult } from '#src/common/types/CommandResult.ts';
import { GateEnding } from '#src/gates/internal/common/constants/GateEnding.ts';

const jestWorkerSigsegv = /A jest worker process \(pid=\d+\) was terminated by another process: signal=SIGSEGV, exitCode=null\./;

// Jest's tally line: `Tests:  1 failed, 5 passed, 6 total`. Not `Test Suites:`,
// which always counts a crashed suite failed and would call every crash real.
const reportedTestFailure = /\bTests:[ \t]+[^\n]*\d+ failed/;

/**
 * Only test runners print a tally: judging `check` or `build` by one would call
 * every lint error a crash.
 */
const testKinds = new Set(['test', 'testCoverage', 'extraTests']);

// Printed whenever Jest got far enough to report at all. A test command that
// failed without it is some other tool failing, which is ordinary evidence.
const jestReported = /\bTest Suites:[ \t]+/;

/**
 * A red that is a dead test runner rather than evidence about the code.
 *
 * Jest can die without naming a signal — banner, then nothing — so the rule is
 * the tally, not a signature: a test gate that went red without a single
 * failing test did not fail, it died.
 *
 * The cost: a test file too broken to run tallies no failed test either, so it
 * is re-run before it is believed.
 */
const isWorkerCrash = ({ kind, result }: { kind: string; result: CommandResult }) => {
	const output = `${result.stdout}\n${result.stderr}`;

	// exit -1 is the runner's own spawn failure, with no gate output to judge.
	if (result.exitCode === -1 || reportedTestFailure.test(output)) {
		return false;
	}

	return jestWorkerSigsegv.test(output) || (testKinds.has(kind) && jestReported.test(output));
};

interface Params {
	kind: string;
	result: CommandResult;
	/** True when this attempt's kill deadline fired. */
	timedOut: boolean;
}

/**
 * The fired deadline is checked first because it is a fact rather than a
 * reading of output: a timed-out attempt carries only the runner's own error
 * text.
 */
export const classifyGateEnding = ({ kind, result, timedOut }: Params): GateEnding => {
	let ending: GateEnding = GateEnding.Failed;

	if (timedOut) {
		ending = GateEnding.Timeout;
	} else if (result.exitCode === 0) {
		ending = GateEnding.Passed;
	} else if (isWorkerCrash({ kind, result })) {
		ending = GateEnding.Crashed;
	}

	return ending;
};
