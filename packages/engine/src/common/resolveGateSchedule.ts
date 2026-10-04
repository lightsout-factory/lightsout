import { GateScheduleKind } from '#src/common/constants/GateScheduleKind.ts';
import type { GateSchedule } from '#src/common/types/GateSchedule.ts';
import type { GateOverride } from '#src/contracts/GateOverride.ts';

interface Params {
	/** The checkpoint's `gate-overrides` entry, as `resolveGateOverride` returns it. */
	override: GateOverride | undefined;
}

/**
 * Shared rather than restated, because the checkpoint and the self-check that
 * precedes it must resolve the same schedule from the same entry — a second
 * three-branch mapping is how the two would come to disagree.
 */
export const resolveGateSchedule = ({ override }: Params): GateSchedule => {
	if (override === undefined) {
		return { kind: GateScheduleKind.Tiered };
	}

	return override === 'off' ? { kind: GateScheduleKind.Off } : { kind: GateScheduleKind.Exact, gates: override };
};
