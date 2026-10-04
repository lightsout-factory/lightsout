import { RawStandardsFinding, type StandardsCheckFunction, type StandardsCheckInputs } from '@lightsout/standards-contracts';
import { z } from 'zod';
import { messageOf } from '#src/common/messageOf.ts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';

const rawFindings = z.array(RawStandardsFinding);

interface Params {
	/** Named in any failure; its id and full name decide the site-key prefix. */
	rule: Pick<LoadedStandardsRule, 'id' | 'name'>;
	run: StandardsCheckFunction;
	inputs: StandardsCheckInputs;
	options: Record<string, number>;
}

/**
 * Swallowing a misbehaving check would turn a broken rule into a rule that
 * silently finds nothing.
 *
 * A check writes its site keys with its short id, since it cannot know which
 * library name a repo registered it under. This is the one place that turns
 * `<rule-id>:` into `<library>/<rule-id>:`, and a key with any other prefix is
 * a library bug, refused like a malformed return.
 *
 * @throws {Error} When the check throws, returns something that is not a list of raw findings, or writes a site key that does not start with its rule id.
 */
export const runRuleCheck = async ({ rule, run, inputs, options }: Params): Promise<RawStandardsFinding[]> => {
	let returned: unknown;

	try {
		returned = await run({ inputs, options });
	} catch (error) {
		throw new Error(`standards rule "${rule.name}" threw while checking: ${messageOf({ error })}`);
	}

	const parsed = rawFindings.safeParse(returned);

	if (!parsed.success) {
		const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'return value'} ${issue.message}`).join('; ');

		throw new Error(`standards rule "${rule.name}" returned something that is not a list of findings: ${issues}`);
	}

	const prefix = `${rule.id}:`;
	const misfiled = parsed.data.find((finding) => !finding.siteKey.startsWith(prefix));

	if (misfiled !== undefined) {
		throw new Error(`standards rule "${rule.name}" wrote the site key "${misfiled.siteKey}", which does not start with its rule id "${prefix}"`);
	}

	return parsed.data.map((finding) => ({ ...finding, siteKey: `${rule.name}:${finding.siteKey.slice(prefix.length)}` }));
};
