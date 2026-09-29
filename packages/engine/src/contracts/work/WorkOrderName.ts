import { z } from 'zod';

/**
 * The word count lives here rather than in the role prompt because this is what
 * the engine can enforce: an answer it cannot turn into a label is rejected at
 * the boundary and never reaches the label.
 */
export const WorkOrderName = z.object({
	words: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+){2,3}$/u, 'a work order name is three or four lowercase words joined by single hyphens'),
});

export type WorkOrderName = z.infer<typeof WorkOrderName>;
