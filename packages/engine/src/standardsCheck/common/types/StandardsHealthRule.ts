import type { StandardsSet } from '@lightsout/standards-contracts';

/**
 * Blocking sites and advice are never mixed: a blocking site's fate is
 * re-checked on disk, while advice has only the agent's own word for it.
 */
export interface StandardsHealthRule {
	/** The full rule name `<library>/<rule-id>` — the one a listing and a finding carry. */
	rule: string;
	set: StandardsSet;
	documentPath: string;
	/** True when the rule has a deterministic check — code that decides, with the same answer every run. */
	deterministic: boolean;
	/** True when the rule has an agent check — an agent reviews the change against it, because it ships no deterministic check or that check decides only part of it. */
	agent: boolean;
	/** Blocking sites frozen into refactor worklists that named this rule. */
	attempted: number;
	/** Frozen sites a batch report shows gone afterwards. */
	resolved: number;
	/** Frozen sites still present in a batch the agent declined. */
	declined: number;
	/** Sites whose fate no parsed report records — failed or aborted batches, and remainders under any other outcome. */
	untracked: number;
	/** Advisory and review findings this rule's advice was taken on. */
	adviceApplied: number;
	/** Advisory and review findings this rule's advice was declined on. */
	adviceDeclined: number;
	/** Advisory and review findings whose end-state the agent found already true — neither taken nor rejected. */
	adviceAlreadyMet: number;
	/** Rationale from batches that left this rule's sites standing, plus each declined advice's reason. */
	reasons: string[];
}
