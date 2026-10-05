import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { PlanFileKind } from '#src/plan/common/constants/PlanFileKind.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';
import { decisionLogReference } from '#src/plan/decisionLog/decisionLogReference.ts';
import { renderDecisionLog } from '#src/plan/decisionLog/renderDecisionLog.ts';
import { getComparableSection } from '#src/plan/lint/common/getComparableSection.ts';

interface Params {
	plan: ParsedPlan;
	/** The finding label: this file's basename. */
	phase: string;
	/** The merged decision record, brainstorm rows first. */
	decisions: DecisionsRecord;
	/** An overview is present, or more than one implementable file is. */
	phased: boolean;
	/** `buildPlanSyncDecisionsCommand(...).command`. */
	syncCommand: string;
}

/** Decided here rather than by each caller, so the lint and the dedup precheck cannot ask one file for two different sections. */
const expectedSection = ({ plan, decisions, phased }: { plan: ParsedPlan; decisions: DecisionsRecord; phased: boolean }) =>
	phased && plan.variant === PlanFileKind.Implementable ? decisionLogReference() : renderDecisionLog({ decisions: decisions.decisions });

/**
 * Blocking, because the saved record is the one authoritative decision history.
 * The section is never hand-edited, so the fix names the sync command. Pure and
 * synchronous: a check that read the disk again could report a difference
 * between two reads rather than one the plan has.
 */
export const checkDecisionLog = ({ plan, phase, decisions, phased, syncCommand }: Params): StructuralFinding[] => {
	const range = plan.decisionLogRange;
	const shared = { check: StructuralCheck.DecisionLogCurrent, severity: FindingSeverity.Blocking, phase } as const;
	const fix = `run \`${syncCommand}\` — the Decision Log is composed from the saved decision records and never edited by hand`;

	if (range === undefined) {
		return [{ ...shared, issue: "no '## Decision Log' section — the engine composes one for every plan file", location: phase, fix }];
	}

	const carried = getComparableSection({ lines: plan.lines.slice(range.start - 1, range.end) });
	const expected = getComparableSection({ lines: expectedSection({ plan, decisions, phased }).split('\n') });

	return carried === expected
		? []
		: [{ ...shared, issue: 'the Decision Log disagrees with the saved decision records', location: `${phase}:${range.start}`, fix }];
};
