import type { SourceEvidenceIndex } from '#src/contracts/plan/evidence/SourceEvidenceIndex.ts';
import { renderEvidenceBrief } from '#src/plan/evidence/renderEvidenceBrief.ts';

interface Params {
	evidence: SourceEvidenceIndex;
}

/** Every entry, unnarrowed: the spawn authoring a plan or an overview has no declaration to narrow by yet. */
export const renderDraftEvidenceBrief = ({ evidence }: Params): string =>
	renderEvidenceBrief({ index: evidence, paths: evidence.entries.map((entry) => entry.path) });
