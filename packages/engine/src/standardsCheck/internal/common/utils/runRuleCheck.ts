import { RawStandardsFinding, type StandardsCheckFunction, type StandardsCheckInput } from '@lightsout/standards-contracts';
import { z } from 'zod';
import { messageOf } from '#src/common/utils/messageOf.ts';

const rawFindings = z.array(RawStandardsFinding);

interface Params {
	/** The rule id — named in any failure, since a broken check is a package bug someone has to find. */
	rule: string;
	run: StandardsCheckFunction;
	input: StandardsCheckInput;
	options: Record<string, number>;
}

/**
 * Swallowing a misbehaving check would turn a broken rule into a rule that
 * silently finds nothing.
 *
 * @throws {Error} When the check throws, or returns something that is not a list of raw findings.
 */
export const runRuleCheck = async ({ rule, run, input, options }: Params): Promise<RawStandardsFinding[]> => {
	let returned: unknown;

	try {
		returned = await run({ input, options });
	} catch (error) {
		throw new Error(`standards rule "${rule}" threw while checking: ${messageOf({ error })}`);
	}

	const parsed = rawFindings.safeParse(returned);

	if (!parsed.success) {
		const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'return value'} ${issue.message}`).join('; ');

		throw new Error(`standards rule "${rule}" returned something that is not a list of findings: ${issues}`);
	}

	return parsed.data;
};
