import { z } from 'zod';
import { WorkReport } from '#src/contracts/work/WorkReport.ts';

/**
 * Declared rather than left implicit so a reader recognises a writers step by
 * parsing the opaque `report` against a contract, not by guessing from the step's id.
 */
export const WritersReport = z.object({
	reports: z.array(WorkReport),
});

export type WritersReport = z.infer<typeof WritersReport>;
