import { BuildMode } from '#src/common/constants/BuildMode.ts';
import type { PhaseDeclaration } from '#src/common/types/PhaseDeclaration.ts';
import { buildModeBulletLabels } from '#src/plan/common/constants/buildModeBulletLabels.ts';
import { planSentinelTokens } from '#src/plan/common/constants/planSentinelTokens.ts';
import { getCodeSpans } from '#src/plan/common/getCodeSpans.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';

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
	buildMode?: PhaseDeclaration['buildMode'];
	buildModeConflict?: true;
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

const saysYes = ({ lines, label }: { lines: string[]; label: string }) =>
	bulletLine({ lines, label })
		?.replace(/^\s*-\s+\*\*[^*]+\*\*/, '')
		.trim()
		.toLowerCase() === 'yes';

/** Both bullets saying yes declares neither mode: guessing which one wins would hide the drafting mistake. */
const buildModeFrom = ({ lines }: { lines: string[] }) => {
	const renamesOnly = saysYes({ lines, label: buildModeBulletLabels[BuildMode.RenamesOnly] });
	const movesOnly = saysYes({ lines, label: buildModeBulletLabels[BuildMode.MoveFoldersAndFiles] });
	let declared: Pick<PhaseBlock, 'buildMode' | 'buildModeConflict'> = {};

	if (renamesOnly && movesOnly) {
		declared = { buildModeConflict: true };
	} else if (renamesOnly) {
		declared = { buildMode: BuildMode.RenamesOnly };
	} else if (movesOnly) {
		declared = { buildMode: BuildMode.MoveFoldersAndFiles };
	}

	return declared;
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
			...buildModeFrom({ lines: blockLines }),
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
			...(block?.buildMode === undefined ? {} : { buildMode: block.buildMode }),
			...(block?.buildModeConflict === true ? { buildModeConflict: true } : {}),
			...(block === undefined ? {} : { blockRange: block.blockRange }),
		};
	});
	const orphans = blocks
		.filter(({ file }) => !claimed.has(file))
		.map(({ file, creates, exports, scripts, fileBudget, buildMode, buildModeConflict, blockRange }) => ({
			number: 0,
			file,
			scope: '',
			creates,
			exports,
			scripts,
			fileBudget,
			...(buildMode === undefined ? {} : { buildMode }),
			...(buildModeConflict === true ? { buildModeConflict } : {}),
			blockRange,
		}));

	return [...declared, ...orphans];
};
