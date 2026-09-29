import type { PhaseDeclaration } from '#src/plan/common/types/PhaseDeclaration.ts';
import { planSentinelTokens } from '#src/plan/internal/common/constants/planSentinelTokens.ts';
import type { ParsedPlan } from '#src/plan/internal/common/types/ParsedPlan.ts';
import { getCodeSpans } from '#src/plan/internal/common/utils/getCodeSpans.ts';

interface Params {
	/** The parsed overview file. */
	plan: ParsedPlan;
}

interface PhaseRow {
	number: number;
	file: string;
	scope: string;
	createdCount?: number;
	touchedCount?: number;
	rowLine: number;
}

interface PhaseBlock {
	file: string;
	creates: string[];
	exports: string[];
	scripts: string[];
	fileBudget?: number;
	renamesOnly?: boolean;
	blockRange: { start: number; end: number };
}

const integerFrom = ({ cell }: { cell: string | undefined }) => (/^\d+$/.test(cell?.trim() ?? '') ? Number(cell?.trim()) : undefined);

const fileFrom = ({ cell }: { cell: string | undefined }) => {
	const candidate = getCodeSpans({ line: cell ?? '' })[0] ?? cell?.trim() ?? '';

	return candidate.endsWith('.md') ? candidate : undefined;
};

const bulletLine = ({ lines, label }: { lines: string[]; label: string }) => {
	const marker = new RegExp(`^\\s*-\\s+\\*\\*${label}:\\*\\*`, 'i');

	return lines.find((line) => marker.test(line));
};

const bulletValues = ({ lines, label }: { lines: string[]; label: string }) => {
	const line = bulletLine({ lines, label });

	return line === undefined ? [] : getCodeSpans({ line }).filter((span) => !planSentinelTokens.has(span));
};

/** Line numbers are absolute, because the span a row covers is read from the overview rather than from the section. */
const rowsFrom = ({ sectionLines, firstLine }: { sectionLines: string[] | undefined; firstLine: number }) => {
	const rows: PhaseRow[] = [];

	for (const [index, line] of (sectionLines ?? []).entries()) {
		if (!line.trim().startsWith('|')) {
			continue;
		}

		const cells = line.split('|').slice(1, -1);
		const number = integerFrom({ cell: cells[0] });
		const file = fileFrom({ cell: cells[1] });

		if (number === undefined || file === undefined) {
			continue;
		}

		rows.push({
			number,
			file,
			scope: cells[2]?.trim() ?? '',
			createdCount: integerFrom({ cell: cells[3] }),
			touchedCount: integerFrom({ cell: cells[4] }),
			rowLine: firstLine + index,
		});
	}

	return rows;
};

/** Read past the label, so the label's own digits can never be the value. */
const fileBudgetFrom = ({ lines }: { lines: string[] }) => {
	const value = bulletLine({ lines, label: 'File budget' })?.replace(/^\s*-\s+\*\*[^*]+\*\*/, '');

	return integerFrom({ cell: /(\d+)/.exec(value ?? '')?.[1] });
};

const renamesOnlyFrom = ({ lines }: { lines: string[] }) => {
	const value = bulletLine({ lines, label: 'Renames only' })?.replace(/^\s*-\s+\*\*[^*]+\*\*/, '');

	return value?.trim().toLowerCase() === 'yes' ? true : undefined;
};

const blocksFrom = ({ sectionLines, firstLine }: { sectionLines: string[] | undefined; firstLine: number }) => {
	const lines = sectionLines ?? [];
	const blocks: { file: string; start: number; lines: string[] }[] = [];

	for (const [index, line] of lines.entries()) {
		const header = /^###\s+Phase\s+\d+\s*[—–-]\s*`([^`]+)`/.exec(line);

		if (header) {
			blocks.push({ file: header[1].trim(), start: firstLine + index, lines: [] });

			continue;
		}

		blocks.at(-1)?.lines.push(line);
	}

	const sectionEnd = firstLine + lines.length - 1;
	const parsed: PhaseBlock[] = [];

	for (const [index, { file, start, lines: blockLines }] of blocks.entries()) {
		parsed.push({
			file,
			creates: bulletValues({ lines: blockLines, label: 'Creates' }),
			exports: bulletValues({ lines: blockLines, label: 'Exports' }),
			scripts: bulletValues({ lines: blockLines, label: 'Scripts' }),
			fileBudget: fileBudgetFrom({ lines: blockLines }),
			renamesOnly: renamesOnlyFrom({ lines: blockLines }),
			blockRange: { start, end: (blocks[index + 1]?.start ?? sectionEnd + 1) - 1 },
		});
	}

	return parsed;
};

const firstLineOf = ({ plan, heading }: { plan: ParsedPlan; heading: string }) => (plan.sectionRanges.get(heading)?.start ?? 0) + 1;

/**
 * The join key is the phase filename, not the number: a hand-edit is likelier
 * to renumber a phase than to rename its file, and joining on the number would
 * silently pair a block with the wrong phase.
 *
 * Malformed input is preserved, never repaired or dropped, because each case is
 * a hand-edit the consistency check exists to catch: a bad count cell parses as
 * `undefined`, and a block matching no row comes back with `number: 0`.
 *
 * `rowLine` and `blockRange` let the grading fingerprint credit that text to
 * this phase rather than to the overview every phase shares.
 */
export const parsePhaseDeclarations = ({ plan }: Params): PhaseDeclaration[] => {
	const rows = rowsFrom({ sectionLines: plan.sections.get('Phases'), firstLine: firstLineOf({ plan, heading: 'Phases' }) });
	const blocks = blocksFrom({ sectionLines: plan.sections.get('Phase Declarations'), firstLine: firstLineOf({ plan, heading: 'Phase Declarations' }) });
	const claimed = new Set<string>();
	const declared = rows.map((row) => {
		const block = blocks.find(({ file }) => file === row.file);

		if (block) {
			claimed.add(block.file);
		}

		return {
			...row,
			creates: block?.creates ?? [],
			exports: block?.exports ?? [],
			scripts: block?.scripts ?? [],
			fileBudget: block?.fileBudget,
			...(block?.renamesOnly === true ? { renamesOnly: true } : {}),
			...(block === undefined ? {} : { blockRange: block.blockRange }),
		};
	});
	const orphans = blocks
		.filter(({ file }) => !claimed.has(file))
		.map(({ file, creates, exports, scripts, fileBudget, renamesOnly, blockRange }) => ({
			number: 0,
			file,
			scope: '',
			creates,
			exports,
			scripts,
			fileBudget,
			...(renamesOnly === true ? { renamesOnly: true } : {}),
			blockRange,
		}));

	return [...declared, ...orphans];
};
