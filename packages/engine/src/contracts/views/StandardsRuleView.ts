import { StandardsSet } from '@lightsout/standards-contracts';
import { z } from 'zod';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

export const StandardsRuleView = z.object({
	rule: z.string(),
	/** '<package name>: <document folder>' — which package states the rule, and where. */
	doc: z.string(),
	/** Package-relative document folder, for linking. */
	documentPath: z.string(),
	set: z.enum(StandardsSet),
	summary: z.string(),
	/** The rule.md body — its full prose argument. */
	prose: z.string(),
	/** True when the rule has a deterministic check — code that decides, with the same answer every run. */
	deterministic: z.boolean(),
	/** True when the rule has an agent check — an agent reviews the change against it, because it ships no deterministic check or that check decides only part of it. */
	agent: z.boolean(),
	severity: z.enum([StandardsSeverity.Blocking, StandardsSeverity.Advisory, StandardsSeverity.Off]),
	/** True when this repo's config set the severity or the options. */
	fromConfig: z.boolean(),
	options: z.record(z.string(), z.number()),
	/** Open findings for this rule in the latest snapshot. */
	findingCount: z.number(),
	history: z.object({
		attempted: z.number(),
		resolved: z.number(),
		declined: z.number(),
		untracked: z.number(),
		adviceApplied: z.number(),
		adviceDeclined: z.number(),
		adviceAlreadyMet: z.number(),
		reasons: z.array(z.string()),
	}),
});

export type StandardsRuleView = z.infer<typeof StandardsRuleView>;
