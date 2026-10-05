import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { GapCheckLens } from '#src/contracts/plan/grade/GapCheckLens.ts';
import type { GapCheckReport } from '#src/contracts/plan/grade/GapCheckReport.ts';

export interface GapResult {
	phase: string;
	lens: GapCheckLens;
	outcome: AgentOutcome<GapCheckReport>;
}
