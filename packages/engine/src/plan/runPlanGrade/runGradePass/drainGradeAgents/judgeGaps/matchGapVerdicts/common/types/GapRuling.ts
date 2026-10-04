import type { GapGroupVerdict } from '#src/contracts/plan/grade/GapGroupVerdict.ts';
import type { GapObservation } from '#src/contracts/plan/grade/GapObservation.ts';

export interface GapRuling {
	verdict?: GapGroupVerdict;
	/** Absent on a single-observation ruling. */
	groupId?: string;
	/** Absent on a single-observation ruling. */
	observations?: GapObservation[];
	/** The citation for this observation's own plan file. */
	answerAt?: string;
	unjudgedReason?: string;
}
