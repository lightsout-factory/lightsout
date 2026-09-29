import type { DecisionRow } from '#src/contracts/plan/decisions/DecisionRow.ts';

interface Params {
	/** Brainstorm first, in record order. */
	decisions: DecisionRow[];
}

/** Line breaks are folded: a break left in would read as a second rule nobody settled. */
const toBullet = ({ text }: { text: string }) => text.trim().replace(/\r?\n/g, ' ');

/** Two rows carrying one question are a rule and its revision; only the later one binds, as in `renderDecisionLog`. */
const liveConstraints = ({ decisions }: { decisions: DecisionRow[] }) => {
	// The same test `getGradeInputs` applies when it decides a row's reach.
	const constraints = decisions.filter((row) => row.question.startsWith('Global constraint:'));
	const binding = new Map<string, number>();

	for (const [index, row] of constraints.entries()) {
		binding.set(row.question, index);
	}

	return constraints.filter((row, index) => binding.get(row.question) === index);
};

/**
 * No trailing newline: the section writer owns how the section joins the file.
 * Pure for the same reason as `renderDecisionLog`.
 */
export const renderGlobalConstraints = ({ decisions }: Params): string => {
	const note = "Composed from this plan's saved decision records — every `Global constraint:` row. Do not edit by hand.";
	const live = liveConstraints({ decisions });
	const bullets = live.length === 0 ? ['- None'] : live.map((row) => `- ${toBullet({ text: row.choice })}`);

	return `## Global Constraints\n\n${note}\n\n${bullets.join('\n')}`;
};
