import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

interface Params {
	findings: StructuralFinding[];
	decisionsPath: string;
	brainstormDecisionsPath?: string;
	factsPath: string;
}

/** The two lists every plan fixer is handed: the findings to resolve, and the files to Read on demand. */
export const renderPlanFixInputs = ({
	findings,
	decisionsPath,
	brainstormDecisionsPath,
	factsPath,
}: Params): { findingList: string; referenceList: string } => {
	const findingLines = findings.map((finding) => `- [${finding.check}] ${finding.location} — ${finding.issue}\n  fix: ${finding.fix}`);
	const referenceLines = [
		`- Decisions record: ${decisionsPath}`,
		...(brainstormDecisionsPath ? [`- Brainstorm decisions (settled during brainstorm, before planning began): ${brainstormDecisionsPath}`] : []),
		`- Verified facts: ${factsPath}`,
	];

	return { findingList: findingLines.join('\n'), referenceList: referenceLines.join('\n') };
};
