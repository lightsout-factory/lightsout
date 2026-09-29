import type { GateRunResult } from '#src/gates/common/types/GateRunResult.ts';

interface Params {
	results: GateRunResult[];
}

export const mergeGateRunResults = ({ results }: Params): GateRunResult => {
	const errors = results.flatMap((result) => (result.error === undefined ? [] : [result.error]));

	return {
		error: errors.length > 0 ? errors.join('\n\n') : undefined,
		failedFamilies: [...new Set(results.flatMap((result) => result.failedFamilies))],
		crashes: results.flatMap((result) => result.crashes),
		timeouts: results.flatMap((result) => result.timeouts),
		// The reservation is taken around the whole schedule, so no stage or group
		// result can carry a coordination reason.
		coordination: undefined,
	};
};
