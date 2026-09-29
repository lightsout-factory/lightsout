import { z } from 'zod';
import { SourceEvidenceEntry } from '#src/contracts/plan/evidence/SourceEvidenceEntry.ts';

/**
 * The persisted `source-evidence.json`, collected once rather than re-read by
 * every spawn. An array of entries rather than an object keyed by path, so it
 * diffs and parses the way every other engine record does.
 */
export const SourceEvidenceIndex = z.object({
	/** Kebab plan name — which plan folder this record belongs to. */
	planName: z.string(),
	/** One entry per repo-relative path, sorted by path. */
	entries: z.array(SourceEvidenceEntry).default([]),
	collectedAt: z.string(),
});

export type SourceEvidenceIndex = z.infer<typeof SourceEvidenceIndex>;
