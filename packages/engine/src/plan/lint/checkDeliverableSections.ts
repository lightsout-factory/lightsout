import { basename } from 'node:path';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { buildPlanSyncDecisionsCommand } from '#src/plan/decisionLog/buildPlanSyncDecisionsCommand.ts';
import type { DeliverableFile } from '#src/plan/internal/common/types/DeliverableFile.ts';
import { checkDecisionLog } from '#src/plan/lint/checkDecisionLog.ts';
import { checkGlobalConstraints } from '#src/plan/lint/checkGlobalConstraints.ts';
import { isPhasedDeliverable } from '#src/plan/lint/internal/common/utils/isPhasedDeliverable.ts';
import { parsePlan } from '#src/plan/parsePlan.ts';

interface Params {
	cwd: string;
	/** Kebab plan name: the folder the plan's own files live in. */
	name: string;
	overviewText?: string;
	files: DeliverableFile[];
	decisions: DecisionsRecord;
}

/**
 * For a caller that runs no structural lint of its own. Both checks sit behind
 * one function so neither can be routed around. Phasing comes from
 * `isPhasedDeliverable`, as in `lintPlanStructure`, so both ask a phase file for
 * the same section.
 */
export const checkDeliverableSections = ({ cwd, name, overviewText, files, decisions }: Params): StructuralFinding[] => {
	const syncCommand = buildPlanSyncDecisionsCommand({ cwd, name }).command;
	const phased = isPhasedDeliverable({ hasOverview: overviewText !== undefined, implementableCount: files.length });
	const texts = [
		...(overviewText === undefined ? [] : [{ base: 'overview.md', text: overviewText }]),
		...files.map((file) => ({ base: basename(file.path), text: file.text })),
	];

	return texts.flatMap(({ base, text }) => {
		const plan = parsePlan({ content: text, base });

		return [
			...checkDecisionLog({ plan, phase: base, decisions, phased, syncCommand }),
			...checkGlobalConstraints({ plan, phase: base, decisions, syncCommand }),
		];
	});
};
