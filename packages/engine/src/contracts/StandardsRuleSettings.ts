import { z } from 'zod';
// No cycle — nothing under `contracts/standardsCheck/` reads the config.
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/** Why an exclude glob is refused, or undefined when it is a glob inside the repository. */
const findExcludeGlobProblem = ({ glob }: { glob: string }) => {
	if (glob === '') {
		return 'an exclude glob cannot be empty';
	}

	if (glob.startsWith('!')) {
		return `exclude glob "${glob}" starts with "!" — an exclude only removes findings, so nothing can be un-excluded`;
	}

	if (glob.startsWith('/') || glob.startsWith('\\') || /^[A-Za-z]:/.test(glob)) {
		return `exclude glob "${glob}" is an absolute path — write it relative to the package root in a pack, or to the repo root in standards-rule-settings`;
	}

	if (glob.split(/[/\\]/).includes('..')) {
		return `exclude glob "${glob}" steps outside with ".." — an exclude names files inside the repository`;
	}

	return undefined;
};

const excludeGlob = z.string().superRefine((glob, ctx) => {
	const problem = findExcludeGlobProblem({ glob });

	if (problem !== undefined) {
		ctx.addIssue({ code: 'custom', message: problem });
	}
});

/**
 * Keyed by rule name — a full `<library>/<rule-id>` name, or a short id where it
 * is unique. The names come from the selected pack, so a mistyped one cannot be
 * caught while parsing: `resolveStandardsGroups` refuses a key naming no rule in
 * the pack. An `exclude` drops the rule's findings after its check runs, its
 * globs read from each file's own workspace package root (the repo root outside
 * packages) in a pack, and from the repo root in a repo's settings.
 */
export const StandardsRuleSettings = z.record(
	z.string(),
	z.union([
		z.enum(StandardsSeverity),
		z
			.object({
				severity: z.enum(StandardsSeverity).optional(),
				options: z.record(z.string(), z.number()).optional(),
				exclude: z.array(excludeGlob).optional(),
			})
			.strict(),
	]),
);

export type StandardsRuleSettings = z.infer<typeof StandardsRuleSettings>;
