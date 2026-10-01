import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { PhaseDeclaration } from '#src/plan/common/types/PhaseDeclaration.ts';
import { writePlanFileIfChanged } from '#src/plan/internal/common/rewriting/writePlanFileIfChanged.ts';
import type { PhaseSizeCounts } from '#src/plan/internal/common/types/PhaseSizeCounts.ts';
import { getPlanTouchedPaths } from '#src/plan/internal/common/utils/getPlanTouchedPaths.ts';
import { parsePhaseDeclarations } from '#src/plan/parsePhaseDeclarations.ts';
import { parsePlan } from '#src/plan/parsePlan.ts';

interface Params {
	/** Absolute path of the overview to rewrite in place. */
	overviewPath: string;
	/** Absolute paths of the authored phase files. */
	phasePaths: string[];
}

const getCounts = async ({ phasePaths }: { phasePaths: string[] }) => {
	const counts = new Map<string, PhaseSizeCounts>();

	for (const phasePath of phasePaths) {
		const base = basename(phasePath);
		const { created, touched } = getPlanTouchedPaths({ plan: parsePlan({ content: await readFile(phasePath, 'utf8'), base }) });

		counts.set(base, { created: created.length, touched: touched.length });
	}

	return counts;
};

/**
 * A row is matched by the phase filename it names — unique per row, and spelled
 * the same whether the cell backticks it or not — rather than by re-parsing the
 * cell, so this needs no second copy of the table parser's cell rules.
 */
const rewriteRows = ({ lines, counts }: { lines: string[]; counts: Map<string, PhaseSizeCounts> }) => {
	const bases = [...counts.keys()];
	let inPhases = false;

	return lines.map((line) => {
		const heading = /^##\s+(.+?)\s*$/.exec(line);

		if (heading) {
			inPhases = heading[1] === 'Phases';

			return line;
		}

		const base = inPhases && line.trim().startsWith('|') ? bases.find((candidate) => line.includes(candidate)) : undefined;
		const size = base === undefined ? undefined : counts.get(base);

		if (size === undefined) {
			return line;
		}

		const indent = /^\s*/.exec(line)?.[0] ?? '';
		const cells = line.trim().split('|').slice(1, -1);

		cells[3] = ` ${size.created} `;
		cells[4] = ` ${size.touched} `;

		return `${indent}|${cells.join('|')}|`;
	});
};

/**
 * The overview is authored before any phase file exists, so its counts are an
 * estimate the consistency check would fail on by a file either way; once the
 * phase files exist the counts are a fact, so the engine states them.
 *
 * The `- **File budget:**` bullet is deliberately not stamped: a budget is a
 * declaration, not a measurement, and the consistency check must still be able
 * to report a phase whose touched count exceeds it. The scope text and declared
 * creates, exports and scripts are left alone for the same reason.
 */
export const stampPhaseCounts = async ({ overviewPath, phasePaths }: Params): Promise<PhaseDeclaration[]> => {
	const counts = await getCounts({ phasePaths });
	const overviewBase = basename(overviewPath);
	const original = await readFile(overviewPath, 'utf8');
	const lines = rewriteRows({ lines: original.split('\n'), counts });

	await writePlanFileIfChanged({ path: overviewPath, original, lines });

	return parsePhaseDeclarations({ plan: parsePlan({ content: lines.join('\n'), base: overviewBase }) });
};
