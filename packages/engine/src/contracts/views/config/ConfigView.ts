import { z } from 'zod';
import { StandardsPackSource } from '#src/contracts/standards/StandardsPackSource.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { ConfigFieldView } from '#src/contracts/views/config/ConfigFieldView.ts';

export const ConfigView = z.object({
	/** Absolute path of the lightsout.config.json that was read. */
	path: z.string(),
	/**
	 * The harness as the file states it, e.g. 'claude-code'; null when unset.
	 * Not resolved to a default because `resolveConfigAndDriver` needs a command.
	 */
	harness: z.string().nullable(),
	/** The model as the file states it, e.g. 'claude-opus-5'; null when unset. Same reason. */
	model: z.string().nullable(),
	sections: z.array(
		z.object({
			title: z.string(),
			fields: z.array(ConfigFieldView),
		}),
	),
	/** The groups this repo's standards resolve to, with no package scope. Empty when standards-pack is false. */
	standardsGroups: z.array(z.object({ packages: z.array(z.string()), pack: z.string(), source: z.enum(StandardsPackSource) })),
	/** Every rule in the selected pack with its effective severity here and whether config set it. */
	ruleStates: z.array(
		z.object({
			/** The full rule name `<library>/<rule-id>` — the one a finding carries. */
			rule: z.string(),
			/** The rule's id inside its library — the address the pack pages use. */
			id: z.string(),
			/** The library that defines the rule. */
			library: z.string(),
			/** The rule's channel — which set of rules it belongs to, and so where the ledger's link to it points. */
			channel: z.string(),
			severity: z.enum([StandardsSeverity.Blocking, StandardsSeverity.Advisory, StandardsSeverity.Off]),
			fromConfig: z.boolean(),
			options: z.record(z.string(), z.number()),
		}),
	),
});

export type ConfigView = z.infer<typeof ConfigView>;
