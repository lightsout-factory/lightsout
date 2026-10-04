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
