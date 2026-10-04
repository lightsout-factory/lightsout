import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { PlanDraftReport } from '#src/contracts/plan/draft/PlanDraftReport.ts';
import type { PhaseDeclaration } from '#src/plan/common/types/PhaseDeclaration.ts';

export interface PhaseOutcome {
	declaration: PhaseDeclaration;
	outcome: AgentOutcome<PlanDraftReport>;
}
