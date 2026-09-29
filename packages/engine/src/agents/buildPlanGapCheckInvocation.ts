import planGapCheckPrompt from '#src/agents/prompts/planGapCheck.md';
import planGapCheckDecisionsPrompt from '#src/agents/prompts/planGapCheckDecisions.md';
import planGapCheckSurfacePrompt from '#src/agents/prompts/planGapCheckSurface.md';
import planGapCheckWiringPrompt from '#src/agents/prompts/planGapCheckWiring.md';
import { GapCheckLens } from '#src/contracts/plan/grade/GapCheckLens.ts';
import type { GradeFindingRecord } from '#src/contracts/plan/memory/GradeFindingRecord.ts';

interface Params {
	planText: string;
	/** Overview plan text — context for a phased plan, never graded standalone. */
	overviewText?: string;
	/** Supplemental code standards, inlined verbatim so standards-conflict can fire. */
	standards?: string;
	/**
	 * The plan's folder, repo-relative, so the wiring checker can open a sibling
	 * phase file and compare shapes across a seam. Only the wiring lens gets it:
	 * the other briefs push seam work to wiring, and a folder they are told to
	 * leave alone invites wandering. Absent for a single-file plan.
	 */
	planDir?: string;
	lens: GapCheckLens;
	/**
	 * The records for this plan file the memory already holds settled — resolved
	 * and noted. Context so the same question is not re-asked, never coverage: the
	 * lens is still read end to end.
	 */
	settled?: GradeFindingRecord[];
}

const settlementOf = ({ record }: { record: GradeFindingRecord }) =>
	record.resolutions[0]?.answerAt ?? record.agentDecision ?? record.answerAt ?? 'settled by an earlier pass';

/** One line per settled record, so a reader can point at the one it means before deciding it has new evidence. */
const settledSection = ({ settled }: { settled: GradeFindingRecord[] }) =>
	[
		'# Findings already settled for this plan file',
		'',
		'These questions were raised against this file by an earlier pass and settled. They are',
		'context, not coverage: read every part of this plan file exactly as you would',
		'without them, and report one of these again only when you have new evidence the',
		'settled answer does not already cover.',
		'',
		...settled.map((record) => `- ${record.id} (${record.status}) — ${record.gap} — settled by: ${settlementOf({ record })}`),
	].join('\n');

const lensBriefs: Record<GapCheckLens, string> = {
	[GapCheckLens.Surface]: planGapCheckSurfacePrompt,
	[GapCheckLens.Wiring]: planGapCheckWiringPrompt,
	[GapCheckLens.Decisions]: planGapCheckDecisionsPrompt,
};

/**
 * A grade run spawns one checker per plan file per lens with the same brief,
 * overview and standards, so those ride the system prompt the harness caches
 * through.
 */
export const buildPlanGapCheckInvocation = ({
	planText,
	overviewText,
	standards,
	planDir,
	lens,
	settled,
}: Params): { systemPrompt: string; prompt: string } => {
	const roleSections = [planGapCheckPrompt, lensBriefs[lens]];

	if (settled && settled.length > 0) {
		roleSections.push(settledSection({ settled }));
	}

	if (planDir && lens === GapCheckLens.Wiring) {
		roleSections.push(
			`# The plan's other phases\n\nThe plan's other phase files are in \`${planDir}\`. Your brief says when to open one — follow a name the plan under check consumes to the phase that defines it; ignore them otherwise.`,
		);
	}

	if (overviewText) {
		roleSections.push(`# Overview (context only — do not grade standalone)\n\n${overviewText}`);
	}

	if (standards) {
		roleSections.push(`# Code standards\n\nThe implementing agent loads these too — flag only where the plan contradicts them:\n\n${standards}`);
	}

	const sections = [
		`# Gap-check input`,
		`## Plan to check\n\n${planText}`,
		'Remember: your entire final message must be exactly one JSON GapCheckReport object — nothing else.',
	];

	return {
		systemPrompt: roleSections.join('\n\n---\n\n'),
		prompt: sections.join('\n\n'),
	};
};
