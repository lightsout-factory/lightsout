import { z } from 'zod';

export const CommandInvocation = z.object({
	/** Stable key matching `CommandFlag.shape`. */
	id: z.string(),
	/** Positional words after the command word that are not flags, e.g. 'verify-facts' or 'on|off'. */
	positional: z.string().optional(),
	/** One-line gloss shown in parentheses on the usage line. */
	note: z.string().optional(),
});

export type CommandInvocation = z.infer<typeof CommandInvocation>;
