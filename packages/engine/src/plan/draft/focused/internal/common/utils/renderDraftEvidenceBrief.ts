import type { SourceEvidenceIndex } from '#src/contracts/plan/evidence/SourceEvidenceIndex.ts';
import { renderEvidenceBrief } from '#src/plan/evidence/renderEvidenceBrief.ts';

interface Params {
	/** The draft's collected evidence. */
	evidence: SourceEvidenceIndex;
}

/**
 * The whole draft's evidence as one writer's brief — every entry the engine
 * collected, in the order it stored them.
 *
 * Both focused flows open with a single spawn that is authoring the plan or the
 * overview, and neither has a declaration to narrow by yet, so both hand over
 * everything. Spelled once because two copies of "render all of it" is one edit
 * away from the single flow and the overview spawn being briefed differently for
 * no stated reason.
 *
 * @returns the rendered section
 */
export const renderDraftEvidenceBrief = ({ evidence }: Params): string =>
	renderEvidenceBrief({ index: evidence, paths: evidence.entries.map((entry) => entry.path) });
