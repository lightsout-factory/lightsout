import { StandardsSet } from '@lightsout/standards-contracts';
import { z } from 'zod';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/**
 * Deliberately not `StandardsRuleView`: that row is about how one repo runs a
 * rule, this one about what the rule is, which is the same on every machine.
 */
export const StandardsPackRuleListing = z.object({
	/** The short id, as a rule page's address carries it. */
	id: z.string(),
	/** The full name `<library>/<id>`. */
	name: z.string(),
	set: z.enum(StandardsSet),
	/** Pack-relative document folder path, e.g. 'code/code-style/functions'. */
	documentPath: z.string(),
	summary: z.string(),
	/** True when the rule has a deterministic check — code that decides, with the same answer every run. */
	deterministic: z.boolean(),
	/** True when the rule has an agent check — an agent reviews the change against it, because it ships no deterministic check or that check decides only part of it. */
	agent: z.boolean(),
	/** `off` for a rule a repo opts into. */
	defaultSeverity: z.enum(StandardsSeverity),
	/** The numbers the rule.md header declares under `options`. */
	defaultOptions: z.record(z.string(), z.number()),
	/** How many files each fixture side holds; both zero for a built pack. */
	fixtureCounts: z.object({ pass: z.number(), fail: z.number() }),
});

export type StandardsPackRuleListing = z.infer<typeof StandardsPackRuleListing>;
