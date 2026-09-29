import type { DecisionRow } from '#src/contracts/plan/decisions/DecisionRow.ts';

interface Params {
	/** Brainstorm first, in record order. */
	decisions: DecisionRow[];
}

/** Everything else is written verbatim: the log records what the human settled, never a paraphrase. */
const toCell = ({ text }: { text: string }) => text.trim().replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');

/** Two rows answering one question are a decision and its revision; the last one binds. */
const bindingRowNumbers = ({ decisions }: { decisions: DecisionRow[] }) => {
	const binding = new Map<string, number>();

	for (const [index, row] of decisions.entries()) {
		binding.set(row.question, index + 1);
	}

	return binding;
};

/** Phase files are bare names, because a backticked path in a plan is a claim about the working tree. */
const toChoiceCell = ({ row, number, binding }: { row: DecisionRow; number: number; binding: Map<string, number> }) => {
	const bindingNumber = binding.get(row.question);
	const markers = [
		row.assumption ? '(assumption)' : undefined,
		row.phases === undefined ? undefined : `(affects ${row.phases.map((phase) => toCell({ text: phase })).join(', ')})`,
		bindingNumber !== undefined && bindingNumber > number ? `(superseded by #${bindingNumber})` : undefined,
	];

	return [toCell({ text: row.choice }), ...markers.filter((marker) => marker !== undefined)].join(' ');
};

/**
 * No trailing newline: the section rewriter owns how the section joins the file.
 *
 * Pure on purpose: the structural lint re-renders this to decide whether a log is
 * stale, and reading a clock, config or disk would report differences nobody made.
 */
export const renderDecisionLog = ({ decisions }: Params): string => {
	const note = "Composed by `lightsout plan sync-decisions` from this plan's saved decision records. Do not edit by hand.";
	const headerRow = '| # | Source | Decision / Question | Options Considered | Choice | Rationale |';
	const separatorRow = '|---|--------|---------------------|--------------------|--------|-----------|';
	const binding = bindingRowNumbers({ decisions });
	const rows = decisions.map((row, index) => {
		const cells = [
			String(index + 1),
			toCell({ text: row.source }),
			toCell({ text: row.question }),
			toCell({ text: row.options }),
			toChoiceCell({ row, number: index + 1, binding }),
			toCell({ text: row.rationale }),
		];

		return `| ${cells.join(' | ')} |`;
	});
	const body = rows.length === 0 ? 'No decisions recorded.' : [headerRow, separatorRow, ...rows].join('\n');

	return `## Decision Log\n\n${note}\n\n${body}`;
};
