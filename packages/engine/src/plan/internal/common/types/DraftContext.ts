import type { ActivityLevel } from '#src/activity/common/types/ActivityLevel.ts';
import type { Effort } from '#src/contracts/Effort.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { Permissions } from '#src/contracts/Permissions.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import type { SourceEvidenceIndex } from '#src/contracts/plan/evidence/SourceEvidenceIndex.ts';
import type { PlanFacts } from '#src/contracts/plan/facts/PlanFacts.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';

/** The escalation from the single to the phased flow hands over exactly the state the first flow started from. */
export interface DraftContext {
	cwd: string;
	driver: Driver;
	name: string;
	workspaceDir: string;
	facts: PlanFacts;
	decisions: DecisionsRecord;
	brainstormDecisionsPath?: string;
	evidence: SourceEvidenceIndex;
	config?: LightsoutConfig;
	/** `executor-file-limit` from config, already defaulted. */
	executorFileLimit: number;
	standards?: string;
	model?: string;
	effort?: Effort;
	permissions?: Permissions;
	timeoutMs: number;
	level?: ActivityLevel;
	progress: (message: string) => void;
}
