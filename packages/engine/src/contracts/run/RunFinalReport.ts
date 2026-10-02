import { z } from 'zod';

/**
 * A run's end-of-run report as its command printed it, kept in the family root's
 * run folder so the outcome stays readable after nobody is watching that
 * command's output.
 */
export const RunFinalReport = z.object({
	/** The report exactly as the command printed it, one entry per line, the run's error included. */
	lines: z.array(z.string()),
	/** The code the command exited with — after ship, not the run's own result. */
	exitCode: z.number().int(),
	/** ISO time the command finished. */
	finishedAt: z.string(),
});

export type RunFinalReport = z.infer<typeof RunFinalReport>;
