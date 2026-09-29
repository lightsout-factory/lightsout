import { evidenceSection } from '#src/agents/buildFocusedPlanWriterInvocation/internal/common/utils/evidenceSection.ts';
import { focusedOverviewSection } from '#src/agents/buildFocusedPlanWriterInvocation/internal/common/utils/focusedOverviewSection.ts';
import { priorArtSection } from '#src/agents/buildFocusedPlanWriterInvocation/internal/common/utils/priorArtSection.ts';
import { selfLintSection } from '#src/agents/buildFocusedPlanWriterInvocation/internal/common/utils/selfLintSection.ts';
import { ledgerSection } from '#src/agents/internal/common/constants/ledgerSection.ts';
import { applyPromptTokens } from '#src/agents/internal/common/utils/applyPromptTokens.ts';
import { documentationRule } from '#src/agents/internal/common/utils/documentationRule.ts';
import { documentationSection } from '#src/agents/internal/common/utils/documentationSection.ts';
import { phaseSection } from '#src/agents/internal/common/utils/phaseSection.ts';
import focusedPlanContractTemplate from '#src/agents/prompts/focusedPlanContractTemplate.md';
import focusedPlanTemplate from '#src/agents/prompts/focusedPlanTemplate.md';
import focusedPlanWriterPrompt from '#src/agents/prompts/focusedPlanWriter.md';
import type { ConfigDocs } from '#src/contracts/ConfigDocs.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { PlanVariant } from '#src/contracts/plan/draft/PlanVariant.ts';
import type { PlanFacts } from '#src/contracts/plan/facts/PlanFacts.ts';
import type { PhaseDeclaration } from '#src/plan/common/types/PhaseDeclaration.ts';
import type { ExportCollision } from '#src/plan/evidence/common/types/ExportCollision.ts';

interface Params {
	facts: PlanFacts;
	decisions: DecisionsRecord;
	outputs: { path: string; variant: PlanVariant }[];
	/** The settled overview text — present only on a phase spawn. */
	overviewText?: string;
	/** The declaration row this spawn authors against — present only on a phase spawn. */
	declaration?: PhaseDeclaration;
	/** The previous phase's declaration row. Absent for phase 1. */
	previousDeclaration?: PhaseDeclaration;
	limits: { executorFileLimit: number; createdFileCeiling: number; touchedFileCeiling: number };
	/** Supplemental code standards, inlined verbatim. */
	standards?: string;
	/** Exact self-lint command the writer runs before reporting. */
	lintCommand?: string;
	/** Exact engine-section sync command the writer runs before its self-lint. */
	syncCommand?: string;
	docs?: ConfigDocs;
	/** `plan.contract` from config — true selects the contract template and the ledger brief. */
	contract?: boolean;
	/** The engine's collected source evidence for this one assignment, already rendered to Markdown. Absent = this spawn was given none. */
	evidenceBrief?: string;
	/** Name-key collisions the export census found for the symbols this spawn will create. An EMPTY array means the census ran and found none; absent means no census was run. */
	collisions?: ExportCollision[];
}

/**
 * An overview output and a `declaration` are mutually exclusive: the first
 * authors the overview alone, the second one phase file.
 *
 * The evidence and census come ahead of the decisions and facts JSON, because
 * evidence a writer meets after kilobytes of records is evidence it reads last.
 *
 * The facts are never trimmed to one assignment: which part of the architectural
 * map bears on one phase is a judgment, not a filter. The evidence arrives
 * already rendered because importing the plan module's renderer here would turn
 * a type-only dependency on `plan` into a runtime cycle.
 */
export const buildFocusedPlanWriterInvocation = ({
	facts,
	decisions,
	outputs,
	overviewText,
	declaration,
	previousDeclaration,
	limits,
	standards,
	lintCommand,
	syncCommand,
	docs,
	contract,
	evidenceBrief,
	collisions,
}: Params): { systemPrompt: string; prompt: string } => {
	const outputLines = outputs.map((output) => `- ${output.path} — variant: ${output.variant}`);
	const sections = [`# Draft input`, `## Feature request\n\n${facts.request}`, `## Output files\n\n${outputLines.join('\n')}`];
	const overview = outputs.find((output) => output.variant === PlanVariant.Overview);

	if (overview) {
		sections.push(focusedOverviewSection({ path: overview.path }));
	}

	if (declaration && overviewText !== undefined) {
		sections.push(phaseSection({ path: outputs[0].path, overviewText, declaration, previousDeclaration, touchedFileCeiling: limits.touchedFileCeiling }));
	}

	if (evidenceBrief) {
		sections.push(evidenceSection({ brief: evidenceBrief }));
	}

	if (collisions !== undefined) {
		sections.push(priorArtSection({ collisions }));
	}

	if (docs && docs.length > 0) {
		sections.push(documentationSection({ docs }));
	}

	if (contract === true) {
		sections.push(ledgerSection);
	}

	sections.push(`## Decisions record\n\n\`\`\`json\n${JSON.stringify(decisions, undefined, '\t')}\n\`\`\``);
	sections.push(`## Verified facts\n\n\`\`\`json\n${JSON.stringify(facts, undefined, '\t')}\n\`\`\``);

	if (standards) {
		sections.push(`## Code standards (supplemental)\n\nApply these where they bear on the plan; they are guidance, not a hard gate:\n\n${standards}`);
	}

	const selfLint = selfLintSection({ lintCommand, syncCommand });

	if (selfLint) {
		sections.push(selfLint);
	}

	sections.push(
		'Remember: write the plan file(s) to disk first, then your entire final message must be exactly one JSON PlanDraftReport object — nothing else.',
	);

	const template = applyPromptTokens({
		text: contract === true ? focusedPlanContractTemplate : focusedPlanTemplate,
		tokens: {
			fileLimit: limits.executorFileLimit,
			createdFileCeiling: limits.createdFileCeiling,
			touchedFileCeiling: limits.touchedFileCeiling,
			documentationRule: documentationRule({ docs }),
		},
	});

	return {
		systemPrompt: `${focusedPlanWriterPrompt}\n\n---\n\n# Plan Template\n\n${template}`,
		prompt: sections.join('\n\n'),
	};
};
