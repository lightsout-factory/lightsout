import type { resolveGates } from '#src/gates/common/resolveGates.ts';
import type { GateCommands } from '#src/gates/common/types/GateCommands.ts';

interface Params {
	gates: ReturnType<typeof resolveGates>;
}

/** Coverage is included whenever configured; `buildGateStages` decides whether it is scheduled. */
export const rootGateCommands = ({ gates }: Params): GateCommands => ({
	check: gates.check,
	test: gates.test,
	testCoverage: typeof gates.testCoverage === 'string' ? gates.testCoverage : undefined,
	extraTests: gates.extraTests,
	build: gates.build,
});
