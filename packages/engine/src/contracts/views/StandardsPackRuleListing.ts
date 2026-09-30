import { StandardsSet } from '@lightsout/standards-contracts';
import { z } from 'zod';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/**
 * Deliberately not `StandardsRuleView`: that row is about how one repo runs a
 * rule, this one about what the rule is, which is the same on every machine.
 */
export const StandardsPackRuleListing = z.object({
	id: z.string(),
	set: z.enum(StandardsSet),
	/** Pack-relative document folder path, e.g. 'code/style-guide/patterns/functions'. */
	documentPath: z.string(),
	summary: z.string(),
	/** 'base' unless the owning document declares a channel. */
	channel: z.string(),
	checked: z.boolean(),
	/** `off` for a rule a repo opts into. */
	defaultSeverity: z.enum(StandardsSeverity),
	/** The numbers the rule.md header declares under `options`. */
	defaultOptions: z.record(z.string(), z.number()),
	/** How many files each fixture side holds; both zero for a built pack. */
	fixtureCounts: z.object({ pass: z.number(), fail: z.number() }),
});

export type StandardsPackRuleListing = z.infer<typeof StandardsPackRuleListing>;
