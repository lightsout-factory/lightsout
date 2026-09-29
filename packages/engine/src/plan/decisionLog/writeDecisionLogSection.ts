import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { SyncedPlanFile } from '#src/plan/common/types/SyncedPlanFile.ts';
import { generatedPlanRegions } from '#src/plan/internal/common/constants/generatedPlanRegions.ts';
import { replaceSectionSpan } from '#src/plan/internal/common/rewriting/replaceSectionSpan.ts';
import { writePlanFileIfChanged } from '#src/plan/internal/common/rewriting/writePlanFileIfChanged.ts';
import { parsePlan } from '#src/plan/parsePlan.ts';

interface Params {
	/** Absolute. */
	path: string;
	/** Heading line included. */
	section: string;
}

/**
 * `## Global Constraints` is the anchor because every plan variant requires it;
 * a file without it is malformed, and the history is appended rather than dropped.
 */
const insertSection = ({ lines, sectionLines }: { lines: string[]; sectionLines: string[] }) => {
	const anchor = lines.findIndex((line) => /^##\s+(.+?)\s*$/.exec(line)?.[1] === generatedPlanRegions.globalConstraints);
	const trailingNewline = lines.at(-1) === '';
	const body = trailingNewline ? lines.slice(0, -1) : lines;

	return anchor === -1
		? [...body, '', ...sectionLines, ...(trailingNewline ? [''] : [])]
		: [...lines.slice(0, anchor), ...sectionLines, '', ...lines.slice(anchor)];
};

/** Not the generic section writer: the Decision Log is inserted before its anchor, not after it. */
export const writeDecisionLogSection = async ({ path, section }: Params): Promise<SyncedPlanFile> => {
	const original = await readFile(path, 'utf8');
	const plan = parsePlan({ content: original, base: basename(path) });
	const sectionLines = section.split('\n');
	const range = plan.decisionLogRange;
	const lines =
		range === undefined
			? insertSection({ lines: plan.lines, sectionLines })
			: replaceSectionSpan({ lines: plan.lines, start: range.start, end: range.end, sectionLines });

	return writePlanFileIfChanged({ path, original, lines });
};
