import { join } from 'node:path';
import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';
import { RuleExampleKind } from '#src/contracts/views/RuleExampleKind.ts';
import type { LoadedStandardsRule } from '#src/standardsPacks/common/types/LoadedStandardsRule.ts';
import { listFixtureFiles } from '#src/standardsPacks/common/utils/listFixtureFiles.ts';

interface Params {
	rule: LoadedStandardsRule;
}

/**
 * Whether a rule's fixtures are the shape its `example` declares, as problem
 * lines. A snippet holds exactly one file a side; a repo's focus file exists on
 * the side that names it. A rule that declares no shape is never a problem —
 * its page reads the shape off the files.
 *
 * Asked here rather than at load, because loading accepts a pack without its
 * fixtures and this is where fixtures are demanded.
 *
 * @param rule - the loaded rule, with its declaration and its fixtures folder
 */
export const checkRuleExample = async ({ rule }: Params): Promise<string[]> => {
	const { example } = rule;
	const problems: string[] = [];

	for (const side of Object.values(FixtureSide)) {
		const files = example === undefined ? [] : await listFixtureFiles({ root: join(rule.fixturesPath, side) });

		if (example?.kind === RuleExampleKind.Snippet && files.length !== 1) {
			problems.push(`${rule.id}: declares a snippet example, but fixtures/${side}/ holds ${files.length} files — a snippet is one file a side`);
		}

		if (example?.kind === RuleExampleKind.Repo && !files.includes(example.focus[side])) {
			problems.push(`${rule.id}: its example focuses ${example.focus[side]}, which fixtures/${side}/ does not hold`);
		}
	}

	return problems;
};
