import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { SyncedPlanFile } from '#src/plan/common/types/SyncedPlanFile.ts';
import { replaceSectionSpan } from '#src/plan/internal/common/rewriting/replaceSectionSpan.ts';
import { writePlanFileIfChanged } from '#src/plan/internal/common/rewriting/writePlanFileIfChanged.ts';
import { parsePlan } from '#src/plan/parsePlan.ts';

interface Params {
	/** Absolute. */
	path: string;
	/** Without the leading `##`. */
	heading: string;
	/** Heading line included. */
	section: string;
	/** The heading this section is placed after when the file carries none; appended at the end when absent or not found. */
	after?: string;
}

const insertSection = ({ lines, anchorEnd, sectionLines }: { lines: string[]; anchorEnd?: number; sectionLines: string[] }) => {
	if (anchorEnd === undefined) {
		const trailingNewline = lines.at(-1) === '';
		const body = trailingNewline ? lines.slice(0, -1) : lines;

		return [...body, '', ...sectionLines, ...(trailingNewline ? [''] : [])];
	}

	return [...lines.slice(0, anchorEnd), ...sectionLines, '', ...lines.slice(anchorEnd)];
};

/** The span comes from the parsed plan, not a rescan, so there is one answer to where a section starts and ends. */
export const writePlanSection = async ({ path, heading, section, after }: Params): Promise<SyncedPlanFile> => {
	const original = await readFile(path, 'utf8');
	const plan = parsePlan({ content: original, base: basename(path) });
	const sectionLines = section.split('\n');
	const range = plan.sectionRanges.get(heading);
	const lines =
		range === undefined
			? insertSection({ lines: plan.lines, anchorEnd: after === undefined ? undefined : plan.sectionRanges.get(after)?.end, sectionLines })
			: replaceSectionSpan({ lines: plan.lines, start: range.start, end: range.end, sectionLines });

	return writePlanFileIfChanged({ path, original, lines });
};
