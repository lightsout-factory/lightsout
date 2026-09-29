import { dim } from '#src/cli/internal/common/terminal/dim.ts';
import { yellow } from '#src/cli/internal/common/terminal/yellow.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

interface Params {
	finding: StructuralFinding;
	/** Where the two lines go — stdout by default; a command reporting findings as its failure passes `console.error`. */
	write?: (line: string) => void;
}

export const printStructuralFinding = ({ finding, write = console.log }: Params): void => {
	const marker = finding.severity === FindingSeverity.Advisory ? dim('note') : yellow('⚠');

	write(`${marker} ${finding.phase} [${finding.check}] ${finding.location} — ${finding.issue}`);
	write(dim(`   fix: ${finding.fix}`));
};
