import type { GateScheduleKind } from '#src/common/constants/GateScheduleKind.ts';

export type GateSchedule =
	| { kind: typeof GateScheduleKind.Single }
	| { kind: typeof GateScheduleKind.Tiered }
	| { kind: typeof GateScheduleKind.Exact; gates: string[] }
	| { kind: typeof GateScheduleKind.Off };
