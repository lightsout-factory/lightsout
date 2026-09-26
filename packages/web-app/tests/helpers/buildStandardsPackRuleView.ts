import { FixtureSide, type RuleExample, RuleExampleKind, type StandardsPackFixture, type StandardsPackRuleView } from '@lightsout/engine';
import { buildStandardsPackRuleListing } from '#tests/helpers/buildStandardsPackRuleListing.ts';

interface Params {
	id?: string;
	prose?: string;
	fixtures?: StandardsPackFixture[];
	example?: RuleExample;
	/** Applied last, so a test can widen the listing half — a different severity, no settings. */
	overrides?: Partial<StandardsPackRuleView>;
}

/** One rule whole, as `getPackRule` hands it back: the listing row, its argument, and one file of proof each way, shown as a snippet. */
export const buildStandardsPackRuleView = ({
	id = 'type-assertion',
	prose = 'Avoid `as` casts. They tell the compiler to trust you.',
	fixtures = [
		{ side: FixtureSide.Fail, path: 'src/readLabel.ts', text: 'return (value as string).toUpperCase();' },
		{ side: FixtureSide.Pass, path: 'src/readLabel.ts', text: "if (typeof value === 'string') {\n\treturn value.toUpperCase();\n}" },
	],
	example = { kind: RuleExampleKind.Snippet },
	overrides = {},
}: Params = {}): StandardsPackRuleView => ({ ...buildStandardsPackRuleListing({ id }), prose, fixtures, example, ...overrides });
