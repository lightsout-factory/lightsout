import { z } from 'zod';

export const PathVerification = z.object({
	pathsChecked: z.number(),
	missingPaths: z.array(z.string()).default([]),
	scriptsChecked: z.number(),
	missingScripts: z.array(z.string()).default([]),
});

export type PathVerification = z.infer<typeof PathVerification>;
