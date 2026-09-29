import type { LedgerRow } from '#src/contracts/plan/ledger/LedgerRow.ts';

interface Params {
	/** Undefined when the section is absent. */
	sectionLines: string[] | undefined;
	/** 1-based line number of the section's first line in the plan file. */
	firstLine: number;
}

const cellsOf = ({ line }: { line: string }) => {
	const cells = line.trim().split('|');

	if (cells[0].trim() === '') {
		cells.shift();
	}

	if (cells.length > 0 && cells[cells.length - 1].trim() === '') {
		cells.pop();
	}

	return cells.map((cell) => cell.trim());
};

const isTableFurniture = ({ cells }: { cells: string[] }) => cells[0].toLowerCase() === 'criterion' || cells.every((cell) => /^:?-{3,}:?$/.test(cell));

/**
 * Columns are Criterion, Test file, Test name and Gate. A malformed row is
 * reported by its line rather than dropped: a criterion the parser silently
 * loses is a criterion nothing ever checks.
 *
 * A blank gate cell means the repository's `test` gate.
 */
export const parseAcceptanceLedger = ({ sectionLines, firstLine }: Params): { rows: LedgerRow[]; malformedLines: number[] } => {
	const rows: LedgerRow[] = [];
	const malformedLines: number[] = [];

	for (const [index, line] of (sectionLines ?? []).entries()) {
		if (!line.trim().startsWith('|')) {
			continue;
		}

		const cells = cellsOf({ line });

		if (cells.length === 0 || isTableFurniture({ cells })) {
			continue;
		}

		const testFile = /`([^`]+)`/.exec(cells[1] ?? '')?.[1].trim();

		if (cells.filter((cell) => cell !== '').length < 3 || testFile === undefined || testFile === '') {
			malformedLines.push(firstLine + index);

			continue;
		}

		rows.push({
			criterion: cells[0],
			testFile,
			testName: cells[2],
			gate: cells[3] === undefined || cells[3] === '' ? 'test' : cells[3],
			line: firstLine + index,
		});
	}

	return { rows, malformedLines };
};
