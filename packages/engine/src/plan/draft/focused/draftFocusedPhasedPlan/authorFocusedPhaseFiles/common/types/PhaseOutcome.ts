import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { PhaseDeclaration } from '#src/common/types/PhaseDeclaration.ts';
import type { PlanDraftReport } from '#src/contracts/plan/draft/PlanDraftReport.ts';

export interface PhaseOutcome {
	declaration: PhaseDeclaration;
	outcome: AgentOutcome<PlanDraftReport>;
}
