import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';
import type { RuleExample } from '#src/contracts/views/RuleExample.ts';
import { RuleExampleKind } from '#src/contracts/views/RuleExampleKind.ts';
import type { StandardsPackFixture } from '#src/contracts/views/StandardsPackFixture.ts';

interface Params {
	/** What rule.md declares under `example`, if anything. */
	declared?: RuleExample;
	/** Every fixture file the rule ships, both sides. */
	fixtures: StandardsPackFixture[];
}

/**
 * How a page shows a rule's examples: what its rule.md declares, or, for a pack
 * that declares nothing, what the files make plain. One file or none a side
 * reads as a snippet; more than that is a repo, opening each side on its first
 * file in path order.
 *
 * @param declared - the rule's own declaration
 * @param fixtures - the rule's fixture files
 */
export const resolveRuleExample = ({ declared, fixtures }: Params): RuleExample => {
	const pass = fixtures.filter((fixture) => fixture.side === FixtureSide.Pass).map((fixture) => fixture.path);
	const fail = fixtures.filter((fixture) => fixture.side === FixtureSide.Fail).map((fixture) => fixture.path);
	const isSnippet = pass.length <= 1 && fail.length <= 1;

	return (
		declared ??
		(isSnippet
			? { kind: RuleExampleKind.Snippet }
			: { kind: RuleExampleKind.Repo, focus: { fail: [...fail].sort()[0] ?? '', pass: [...pass].sort()[0] ?? '' } })
	);
};
