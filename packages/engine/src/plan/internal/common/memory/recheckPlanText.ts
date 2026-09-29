import { basename } from 'node:path';
import type { DeliverableFile } from '#src/plan/internal/common/types/DeliverableFile.ts';

interface Params {
	files: DeliverableFile[];
	overviewText?: string;
	/** The record's `phase` — a deliverable basename, `overview.md`, or a phase that no longer exists. */
	phase: string;
}

/**
 * Falls back to the whole plan because a record can name no deliverable file:
 * the documentation checker stamps `overview.md`, and a resplit can rename a
 * phase away. A record that could never be re-verified would block forever.
 *
 * The judge's prompt and both citation checks must read this same text, or a
 * quote accepted at closing time would fail its re-check on rendering alone.
 */
export const recheckPlanText = ({ files, overviewText, phase }: Params): string => {
	const own = files.find((file) => basename(file.path) === phase);
	const rendered = files.map((file) => `## Plan file: ${basename(file.path)}\n\n${file.text}`);
	const wholePlan = [...(overviewText === undefined ? [] : [overviewText]), ...rendered].join('\n\n');

	return own?.text ?? wholePlan;
};
