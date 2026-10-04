import type { GateSchedule } from '#src/common/types/GateSchedule.ts';
import { buildGateStages } from '#src/gates/common/buildGateStages.ts';
import { GateTier } from '#src/gates/common/constants/GateTier.ts';
import { gateTierOf } from '#src/gates/common/gateTierOf.ts';
import type { GateEntry } from '#src/gates/common/types/GateEntry.ts';

interface Params {
	entries: GateEntry[];
	schedule: GateSchedule;
	/** Whether the coverage gate can give a true answer at this step. */
	coverage?: boolean;
}

/**
 * The cheap gates plus the build: the agent sees the failures it is about to be
 * judged on without the run paying for the slow suites twice.
 *
 * Coverage is filtered here too because `buildGateStages` ignores `coverage`
 * for an `exact` schedule, and at the implement step fresh source has no tests
 * yet, so coverage would be red by construction.
 */
export const selfCheckGateNames = ({ entries, schedule, coverage }: Params): string[] =>
	buildGateStages({ entries, schedule, coverage })
		.flat()
		.filter((entry) => gateTierOf({ family: entry.family }) === GateTier.Cheap || entry.family === 'build')
		.filter((entry) => coverage === true || entry.name !== 'test-coverage')
		.map((entry) => entry.name);
