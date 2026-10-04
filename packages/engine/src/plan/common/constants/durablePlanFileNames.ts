import { brainstormNotesFileName } from '#src/common/constants/brainstormNotesFileName.ts';
import { gradeMemoryFileName } from '#src/common/constants/gradeMemoryFileName.ts';
import { gradeFileName } from '#src/plan/common/constants/gradeFileName.ts';

/**
 * The files in a plan folder that travel; everything else is run state and
 * never leaves the machine that made it. One object, because publish and fetch
 * must match against exactly the same names.
 *
 * `deliverable` mirrors `resolvePlanDeliverable` and is NOT a safety guard: it
 * admits a path separator. A caller reading attachment titles a stranger can set
 * rejects a non-bare name first, and must not narrow this pattern to do it, or
 * the fetch would refuse a phase file publish uploads.
 *
 * The annotation is written out rather than `as const` so `records` is a
 * `string[]` a caller can `includes` a plain string against.
 *
 * `grade-memory.json` travels because it holds the plan's settled decisions;
 * `grade-history.jsonl` is local debugging state.
 */
export const durablePlanFileNames: { records: string[]; deliverable: RegExp } = {
	records: [brainstormNotesFileName, 'decisions.json', gradeFileName, gradeMemoryFileName],
	deliverable: /^(?:plan\.md|overview\.md|phase\d+.*\.md)$/,
};
