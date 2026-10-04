import planReshapePrompt from '#src/agents/prompts/planReshape.md';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

interface Params {
	findings: StructuralFinding[];
	/** Absolute path(s) of the overview file to Edit in place. */
	planPaths: string[];
	/** The hard per-phase created-file ceiling, stated so the reshaper splits against the same number the check applies. */
	createdFileCeiling: number;
	/** The hard per-phase touched-file ceiling, stated so the reshaper splits against the same number the check applies. */
	touchedFileCeiling: number;
	/** Absolute path of the workspace's decisions.json — the reshaper Reads it on demand. */
	decisionsPath: string;
	/** Absolute path of the workspace's brainstorm-decisions.json when one exists — the reshaper Reads it on demand. */
	brainstormDecisionsPath?: string;
	/** Absolute path of the workspace's facts.json — the reshaper Reads it on demand. */
	factsPath: string;
}

/**
 * A sibling of `buildPlanRepairInvocation` rather than a use of it: the
 * repairer's role prompt makes minimal, non-restructuring edits a hard rule,
 * which keeps it safe on a finished plan and is exactly what re-splitting a
 * breakdown is not.
 */
export const buildPlanReshapeInvocation = ({
	findings,
	planPaths,
	createdFileCeiling,
	touchedFileCeiling,
	decisionsPath,
	brainstormDecisionsPath,
	factsPath,
}: Params): { systemPrompt: string; prompt: string } => {
	const findingLines = findings.map((finding) => `- [${finding.check}] ${finding.location} — ${finding.issue}\n  fix: ${finding.fix}`);
	const referenceLines = [
		`- Decisions record: ${decisionsPath}`,
		...(brainstormDecisionsPath ? [`- Brainstorm decisions (settled during brainstorm, before planning began): ${brainstormDecisionsPath}`] : []),
		`- Verified facts: ${factsPath}`,
	];
	const sections = [
		`# Reshape input`,
		`## Overview file to reshape (Edit in place)\n\n- ${planPaths.join('\n- ')}`,
		`## Created-file ceiling\n\nNo phase may declare more than ${createdFileCeiling} created source files. This is fixed and no declaration raises it.`,
		`## Touched-file ceiling\n\nNo phase may declare more than ${touchedFileCeiling} touched source files, and a \`## File Budget\` never raises that. There are two exemptions: a phase whose declaration block carries \`- **Renames only:** yes\`, a bullet only for a phase whose whole work is renaming, and a phase whose declaration block carries \`- **Moves folders and files only:** yes\`, a bullet only for a phase whose whole work is moving folders and files.`,
		`## Breakdown findings to resolve\n\n${findingLines.join('\n')}`,
		`## Reference files (Read on demand)\n\n${referenceLines.join('\n')}`,
		'Remember: re-split the phase breakdown, touch nothing else, then your entire final message must be exactly one JSON PlanFixReport object — nothing else.',
	];

	return {
		systemPrompt: planReshapePrompt,
		prompt: sections.join('\n\n'),
	};
};
