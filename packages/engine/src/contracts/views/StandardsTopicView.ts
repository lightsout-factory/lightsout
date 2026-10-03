import { StandardsSet } from '@lightsout/standards-contracts';
import { z } from 'zod';

export const StandardsTopicView = z.object({
	set: z.enum(StandardsSet),
	/** The topic's path in its library, e.g. 'code/frameworks/react' — its address minus the library name. */
	path: z.string(),
	/** topic.md body — the title and the background its rules share. */
	intro: z.string(),
	/** Short rule ids in reading order. */
	ruleIds: z.array(z.string()),
});

export type StandardsTopicView = z.infer<typeof StandardsTopicView>;
