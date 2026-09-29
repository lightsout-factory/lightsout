import { gateBlockedLabel } from '#src/gates/gateHolds/common/constants/gateBlockedLabel.ts';
import type { GateHolds } from '#src/gates/gateHolds/common/types/GateHolds.ts';

interface Params {
	holds: GateHolds;
	identifier: string;
	labels: string[];
}

/**
 * Each half closes the other's hole. The gate-hold file is what blocks when the
 * label write never landed; the label is what blocks when the gate-hold file was
 * lost — a failed write, or somebody clearing `.lightsout` in the primary
 * checkout.
 *
 * One predicate on purpose: the parked scan, wave selection and the
 * command-edge guard must not answer this question three ways.
 */
export const isTicketGateHeld = ({ holds, identifier, labels }: Params): boolean =>
	holds[identifier.toLowerCase()] !== undefined || labels.includes(gateBlockedLabel);
