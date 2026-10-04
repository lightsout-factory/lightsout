import type { GateRunResult } from '#src/gates/common/types/GateRunResult.ts';

interface Params {
	result: GateRunResult;
}

/**
 * No caller may spend a fix on such a run or call it red, because no gate
 * command returned a verdict. Coordination is checked first, then crash, then
 * timeout; the full gate output rides beside the reason and still names any
 * other gate.
 *
 * @returns the stop reason, or undefined when the result is a verdict
 */
export const describeGateNoVerdict = ({ result }: Params): string | undefined => {
	let reason: string | undefined;

	if (result.coordination !== undefined) {
		reason = result.coordination;
	} else if (result.crashes.length > 0) {
		reason = [result.crashes.join('\n'), 'No fix attempt was spent: a gate that crashed returned no verdict about the code.', result.error ?? ''].join('\n\n');
	} else if (result.timeouts.length > 0) {
		reason = [
			result.timeouts.join('\n'),
			'No fix attempt was spent: a gate that ran past its ceiling returned no verdict about the code.',
			result.error ?? '',
		].join('\n\n');
	}

	return reason;
};
