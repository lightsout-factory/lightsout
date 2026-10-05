import { GateScheduleKind } from '#src/common/constants/GateScheduleKind.ts';
import type { GateSchedule } from '#src/common/types/GateSchedule.ts';

const stageCounts: Record<GateScheduleKind, number> = {
	[GateScheduleKind.Single]: 1,
	[GateScheduleKind.Tiered]: 2,
	[GateScheduleKind.Exact]: 1,
	[GateScheduleKind.Off]: 0,
};

interface Params {
	schedule: GateSchedule;
}

export const stageCountOf = ({ schedule }: Params): number => stageCounts[schedule.kind];
