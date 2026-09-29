import { GateScheduleKind } from '#src/gates/common/constants/GateScheduleKind.ts';
import type { GateSchedule } from '#src/gates/common/types/GateSchedule.ts';
import { GateTier } from '#src/gates/internal/common/constants/GateTier.ts';
import type { GateEntry } from '#src/gates/internal/common/types/GateEntry.ts';
import { gateTierOf } from '#src/gates/internal/common/utils/gateTierOf.ts';

/**
 * Selects from the group's own entries, so a name this group has no entry for
 * contributes nothing rather than failing the group.
 */
const selectNamed = ({ entries, gates }: { entries: GateEntry[]; gates: string[] }) => gates.flatMap((name) => entries.filter((entry) => entry.name === name));

/**
 * Never schedules coverage beside the plain unit suite: a coverage command runs
 * the same tests instrumented, so both would be the same fleet twice.
 */
const selectDefault = ({ entries, coverage }: { entries: GateEntry[]; coverage?: boolean }) => {
	const scheduled = entries.filter((entry) => entry.name !== 'test-coverage' || coverage === true);
	const instrumented = scheduled.some((entry) => entry.name === 'test-coverage');

	return scheduled.filter((entry) => entry.name !== 'test' || !instrumented);
};

const inTier = ({ entries, tier }: { entries: GateEntry[]; tier: GateTier }) => entries.filter((entry) => gateTierOf({ family: entry.family }) === tier);

interface Params {
	entries: GateEntry[];
	schedule: GateSchedule;
	/** Ignored by `exact`, which names its gates itself. */
	coverage?: boolean;
}

/**
 * The boundary between two returned lists is where every group in scope waits.
 * This is the single place that decides whether the coverage gate is scheduled.
 */
export const buildGateStages = ({ entries, schedule, coverage }: Params): GateEntry[][] => {
	if (schedule.kind === GateScheduleKind.Off) {
		return [];
	}

	if (schedule.kind === GateScheduleKind.Exact) {
		return [selectNamed({ entries, gates: schedule.gates })];
	}

	const scheduled = selectDefault({ entries, coverage });

	return schedule.kind === GateScheduleKind.Tiered
		? [inTier({ entries: scheduled, tier: GateTier.Cheap }), inTier({ entries: scheduled, tier: GateTier.Expensive })]
		: [scheduled];
};
