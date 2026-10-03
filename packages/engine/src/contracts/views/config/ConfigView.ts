import { z } from 'zod';
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
	/**
	 * The groups this repo's standards resolve to, with no package scope: one per
	 * distinct set of packs. Empty when standards-pack is unset or false and
	 * package-standards-packs names no package.
	 */
	standardsGroups: z.array(
		z.object({
			/** Package folder names under packages-dir; '' is the repo root group. */
			packages: z.array(z.string()),
			/** The packages as one label, the root group named first. */
			appliesTo: z.string(),
			/** The pack address the config names; several are joined with ` + `. */
			pack: z.string(),
			/** Addresses of the conditional packs that applied to these packages; empty when none did. */
			conditionalPacks: z.array(z.string()),
		}),
	),
	/** Every rule in the groups' packs, once per distinct state, with its effective severity, whether config set it and where it holds. */
	ruleStates: z.array(
		z.object({
			/** The full rule name `<library>/<rule-id>` — the one a finding carries. */
			rule: z.string(),
			/** The rule's id inside its library — the address the pack pages use. */
			id: z.string(),
			/** The library that defines the rule. */
			library: z.string(),
			severity: z.enum([StandardsSeverity.Blocking, StandardsSeverity.Advisory, StandardsSeverity.Off]),
			fromConfig: z.boolean(),
			options: z.record(z.string(), z.number()),
			/** The package folder names this state applies to; '' is the repo root group. */
			packages: z.array(z.string()),
			/** The packages as one label, the root group named first. */
			appliesTo: z.string(),
		}),
	),
});

export type ConfigView = z.infer<typeof ConfigView>;
