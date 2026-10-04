import { join } from 'node:path';
import { listFixtureFiles } from '#src/common/listFixtureFiles.ts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';
import { RuleExampleKind } from '#src/contracts/views/RuleExampleKind.ts';

interface Params {
	rule: LoadedStandardsRule;
}

/**
 * Asked here rather than at load, because loading accepts a pack without its
 * fixtures and this is where fixtures are demanded.
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
