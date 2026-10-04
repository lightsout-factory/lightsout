import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { BatchStop } from '#src/refactor/common/types/BatchStop.ts';

/** `workFindings` are the sites that survived a pass which did change the tree — the work a requeue would carry. */
export type PassOutcome = { stop: BatchStop } | { workFindings: StandardsFinding[] };
