import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';
import type { GradeReport } from '#src/contracts/plan/grade/GradeReport.ts';
import type { PhaseWeight } from '#src/contracts/plan/grade/PhaseWeight.ts';
import { PlanGrade } from '#src/contracts/plan/grade/PlanGrade.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { GradeInputs } from '#src/contracts/plan/memory/GradeInputs.ts';
import { GradeScope } from '#src/contracts/plan/memory/GradeScope.ts';
import { getBlockingFindings } from '#src/plan/common/utils/getBlockingFindings.ts';
import { getBlockingGaps } from '#src/plan/common/utils/getBlockingGaps.ts';
import { gapCheckLenses } from '#src/plan/internal/common/constants/gapCheckLenses.ts';

interface Params {
	name: string;
	phases?: string[];
	structural: StructuralFinding[];
	gaps: GradedGap[];
	/** Empty means every check finished. */
	failures: string[];
	/** The plan files every lens returned for. */
	phasesChecked: string[];
	weights?: PhaseWeight[];
	phasesLight?: string[];
	/** Absent outside a git worktree. */
	commit?: string;
	treeDirty?: boolean;
	/** A statement about this pass alone; it does not decide whether the plan is approved. */
	scope?: GradeScope;
	focusedOn?: string[];
	inputs?: GradeInputs;
	scopeReason?: string;
	/** What `lenses` states, and what `scopeComplete` holds `phasesChecked` against. */
	phasesRequired: string[];
	/** True too when the checker had nothing to do on this pass. */
	documentationComplete: boolean;
	/** Overview excluded. Absent on a pass that makes no coverage claim at all: the structural preflight stop. */
	planFiles?: string[];
	/** Read only when `planFiles` is supplied. */
	covered?: string[];
	/** Read only when `planFiles` is supplied; false by default so an unanswered claim fails closed. */
	documentationCovered?: boolean;
}

/**
 * No `planFiles` makes no coverage claim: the structural preflight stop is
 * already incomplete on the failure that stopped it. An EMPTY one makes the
 * claim and fails it: a deliverable that offered no plan file established
 * nothing.
 *
 * The covered set is checked to CONTAIN each plan file, never inferred from an
 * empty failure list.
 */
const coverageReasons = ({ planFiles, covered, documentationCovered }: { planFiles?: string[]; covered: string[]; documentationCovered: boolean }) => {
	if (planFiles === undefined) {
		return [];
	}

	const uncovered = planFiles.filter((file) => !covered.includes(file));
	const files = planFiles.length === 0 ? ['no plan file was offered, so nothing is covered'] : [];
	const unread = uncovered.length === 0 ? [] : [`no reading covers ${uncovered.join(', ')} at its current text`];
	const documentation = documentationCovered ? [] : ['the whole-plan documentation record does not stand at the current plan text'];

	return [...files, ...unread, ...documentation];
};

/**
 * Narrower than `complete`: whether every check this pass's own scope called for
 * finished, which is what the repair baseline asks.
 *
 * Computed from positive per-file evidence: an empty failure list would not
 * notice a phase whose readers never started, and the rate-limit flag also
 * covers judges, so it would reject good reading when only a judge failed.
 */
const isScopeComplete = ({
	phases,
	phasesRequired,
	phasesChecked,
	phasesLight,
	gaps,
	documentationComplete,
}: {
	phases?: string[];
	phasesRequired: string[];
	phasesChecked: string[];
	phasesLight: string[];
	gaps: GradedGap[];
	documentationComplete: boolean;
}) =>
	// A human's `--phase` narrowing speaks for the files they chose, never for the ones they left out.
	phases === undefined &&
	// A light file counts: it is an exemption the weighing made, not an unread file.
	(phasesRequired.length > 0 || phasesLight.length > 0) &&
	// `phasesChecked` names a file only when EVERY lens returned for it.
	phasesRequired.every((phase) => phasesChecked.includes(phase)) &&
	// Memory never carries an unjudged question, so only re-reading its plan file could settle it — and a baseline is a request not to.
	gaps.every(({ outcome }) => outcome !== GapOutcome.Unjudged) &&
	documentationComplete;

/**
 * An incomplete pass is never an A whatever it found. A pass is an A when
 * nothing BLOCKING is left, not when nothing was found. A finding no judge
 * settled blocks: failing closed costs one extra question, failing open lets an
 * unweighed finding pass as a clean bill.
 *
 * `complete` speaks for the whole plan, not this one pass: every plan file
 * covered at its current text, by this pass or a recorded earlier one. A failed
 * judge does not make a pass incomplete, because its finding already blocks.
 *
 * `lenses` states what actually ran, so an empty list reads as "no reader ran",
 * never as "every lens ran and found nothing".
 */
export const createGradeReport = ({
	name,
	phases,
	structural,
	gaps,
	failures,
	phasesChecked,
	weights = [],
	phasesLight = [],
	commit,
	treeDirty,
	scope = GradeScope.Full,
	focusedOn = [],
	inputs,
	scopeReason,
	phasesRequired,
	documentationComplete,
	planFiles,
	covered = [],
	documentationCovered = false,
}: Params): GradeReport => {
	const narrowed = phases === undefined ? [] : [`graded a subset on request: ${phases.join(', ')} — the structural findings still cover every plan file`];
	// Failures first: a checker that fell over is the cause, and the uncovered
	// plan files are usually its consequence.
	const reasons = [...narrowed, ...failures, ...coverageReasons({ planFiles, covered, documentationCovered })];
	const complete = reasons.length === 0;
	const grade =
		complete && getBlockingFindings({ findings: structural }).length === 0 && getBlockingGaps({ gaps }).length === 0 ? PlanGrade.A : PlanGrade.BelowA;

	return {
		planName: name,
		grade,
		structural,
		gaps,
		phasesChecked,
		// From what was owed, not from `phasesChecked`: a reader that failed also
		// leaves `phasesChecked` empty, and that pass did spawn its lenses.
		lenses: phasesRequired.length === 0 ? [] : gapCheckLenses,
		weights,
		phasesLight,
		complete,
		scopeComplete: isScopeComplete({ phases, phasesRequired, phasesChecked, phasesLight, gaps, documentationComplete }),
		incompleteReason: complete ? undefined : reasons.join('; '),
		passed: grade === PlanGrade.A,
		gradedAt: new Date().toISOString(),
		gradedCommit: commit,
		gradedTreeDirty: treeDirty,
		scope,
		focusedOn,
		covered,
		inputs,
		scopeReason,
	};
};
