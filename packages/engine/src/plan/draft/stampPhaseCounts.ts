import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { PhaseDeclaration } from '#src/common/types/PhaseDeclaration.ts';
import { expandFolderMoves } from '#src/plan/common/expandFolderMoves/expandFolderMoves.ts';
import { getPlanTouchedPaths } from '#src/plan/common/getPlanTouchedPaths.ts';
import { parsePhaseDeclarations } from '#src/plan/common/phases/parsePhaseDeclarations.ts';
import { readPhaseFiles } from '#src/plan/common/phases/readPhaseFiles.ts';
import { writePlanFileIfChanged } from '#src/plan/common/rewriting/writePlanFileIfChanged.ts';
import type { PhaseSizeCounts } from '#src/plan/common/types/PhaseSizeCounts.ts';
import { parsePlan } from '#src/plan/parsePlan/parsePlan.ts';

interface Params {
	/** The run's working directory, from which git lists the files a folder move carries. */
	cwd: string;
	/** Absolute path of the overview to rewrite in place. */
	overviewPath: string;
	/** Absolute paths of the authored phase files. */
	phasePaths: string[];
}

/**
 * Counted through the same expander as the lint, so the stamped counts and the
 * lint's agree. The expander's findings are the lint's to report, and a phase
 * file that cannot be read is left unstamped for the closing lint to report.
 */
const getCounts = async ({ cwd, phasePaths }: { cwd: string; phasePaths: string[] }) => {
	const { phases } = await readPhaseFiles({ planPaths: phasePaths });
	const expansion = await expandFolderMoves({ cwd, phases: phases.sort((one, other) => one.number - other.number) });
	const counts = new Map<string, PhaseSizeCounts>();

	for (const phase of expansion.phases) {
		const { created, touched } = getPlanTouchedPaths({ plan: phase.plan });

		counts.set(phase.base, { created: created.length, touched: touched.length });
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
export const stampPhaseCounts = async ({ cwd, overviewPath, phasePaths }: Params): Promise<PhaseDeclaration[]> => {
	const counts = await getCounts({ cwd, phasePaths });
	const overviewBase = basename(overviewPath);
	const original = await readFile(overviewPath, 'utf8');
	const lines = rewriteRows({ lines: original.split('\n'), counts });

	await writePlanFileIfChanged({ path: overviewPath, original, lines });

	return parsePhaseDeclarations({ plan: parsePlan({ content: lines.join('\n'), base: overviewBase }) });
};
