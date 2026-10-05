import { describe, expect, test } from '@jest/globals';
import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';
import { RuleExampleKind } from '#src/contracts/views/RuleExampleKind.ts';
import type { StandardsPackFixture } from '#src/contracts/views/StandardsPackFixture.ts';
import { resolveRuleExample } from '#src/views/getStandardsPackBundle/resolveRuleExample.ts';

/** Fixture files at the given paths, each on the named side. */
const fixturesAt = ({ fail, pass }: { fail: string[]; pass: string[] }): StandardsPackFixture[] => [
	...pass.map((path) => ({ side: FixtureSide.Pass, path, text: '' })),
	...fail.map((path) => ({ side: FixtureSide.Fail, path, text: '' })),
];

describe('resolveRuleExample', () => {
	test('keeps what the rule declares, whatever the files look like', () => {
		const declared = { kind: RuleExampleKind.Repo, focus: { fail: 'src/b.ts', pass: 'src/b.ts' } } as const;

		const example = resolveRuleExample({ declared, fixtures: fixturesAt({ fail: ['src/b.ts'], pass: ['src/b.ts'] }) });

		expect(example).toStrictEqual(declared);
	});

	test('reads one file a side as a snippet when nothing is declared', () => {
		const example = resolveRuleExample({ fixtures: fixturesAt({ fail: ['src/a.ts'], pass: ['src/a.ts'] }) });

		expect(example).toStrictEqual({ kind: RuleExampleKind.Snippet });
	});

	test('reads several files a side as a repo opening on each side’s first file', () => {
		const example = resolveRuleExample({ fixtures: fixturesAt({ fail: ['src/z.ts', 'src/b.ts'], pass: ['src/a.ts', 'package.json'] }) });

		expect(example).toStrictEqual({ kind: RuleExampleKind.Repo, focus: { fail: 'src/b.ts', pass: 'package.json' } });
	});
});
