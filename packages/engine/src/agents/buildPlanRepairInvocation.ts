import { renderDocsSurfaces } from '#src/agents/internal/common/utils/renderDocsSurfaces.ts';
import planRepairPrompt from '#src/agents/prompts/planRepair.md';
import type { ConfigDocs } from '#src/contracts/ConfigDocs.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

interface Params {
	findings: StructuralFinding[];
	/** Absolute paths of the drafted plan file(s) to Edit in place. */
	planPaths: string[];
	/** Absolute path of the workspace's decisions.json — the repairer Reads it on demand. */
	decisionsPath: string;
	/** Absolute path of the workspace's brainstorm-decisions.json when one exists — the repairer Reads it on demand. */
	brainstormDecisionsPath?: string;
	/** Absolute path of the workspace's facts.json — the repairer Reads it on demand. */
	factsPath: string;
	/** The repository's declared documentation surfaces. Absent when it declares none. */
	docs?: ConfigDocs;
}

/**
 * A missing `## Documentation` heading is one of the findings the repairer
 * resolves, and its role prompt forbids inventing a section's content, so it
 * needs the declared surfaces to work from.
 */
const documentationSection = ({ docs }: { docs: ConfigDocs }) =>
	`## Documentation surfaces

This repository declares the documents below. A \`## Documentation\` section
states either the declared documents the plan touches, each in a backticked
span and each also listed under one of the plan's file headings, or the exact
sentence \`Nothing user-facing — no docs needed.\` Decide which from what the
plan already says it builds; do not invent a document.

${renderDocsSurfaces({ docs })}`;

/**
 * The facts and decisions go in as paths the repairer Reads only when a fix
 * needs them, so the common mechanical repair never pays for them. The plan
 * template is absent because the repair role edits, never re-authors.
 */
export const buildPlanRepairInvocation = ({
	findings,
	planPaths,
	decisionsPath,
	brainstormDecisionsPath,
	factsPath,
	docs,
}: Params): { systemPrompt: string; prompt: string } => {
	const findingLines = findings.map((finding) => `- [${finding.check}] ${finding.location} — ${finding.issue}\n  fix: ${finding.fix}`);
	const referenceLines = [
		`- Decisions record: ${decisionsPath}`,
		...(brainstormDecisionsPath ? [`- Brainstorm decisions (settled during brainstorm, before planning began): ${brainstormDecisionsPath}`] : []),
		`- Verified facts: ${factsPath}`,
	];
	const sections = [
		`# Repair input`,
		`## Plan files to repair (Edit in place)\n\n- ${planPaths.join('\n- ')}`,
		`## Structural findings to resolve\n\n${findingLines.join('\n')}`,
		...(docs && docs.length > 0 ? [documentationSection({ docs })] : []),
		`## Reference files (Read on demand)\n\n${referenceLines.join('\n')}`,
		'Remember: minimal edits resolving only the flagged findings, then your entire final message must be exactly one JSON PlanFixReport object — nothing else.',
	];

	return {
		systemPrompt: planRepairPrompt,
		prompt: sections.join('\n\n'),
	};
};
