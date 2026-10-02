import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { RuleExample } from '#src/contracts/views/RuleExample.ts';
import { RuleExampleKind } from '#src/contracts/views/RuleExampleKind.ts';
import { checkRuleExample } from '#src/standardsCheck/internal/common/utils/fixtureChecks/checkRuleExample.ts';

/** A rule declaring the given example, over a fixtures folder holding the given files a side. */
const setupRule = ({ example, fail, pass }: { example?: RuleExample; fail: string[]; pass: string[] }) => {
	const fixturesPath = join(mkdtempSync(join(tmpdir(), 'lightsout-example-')), 'fixtures');

	for (const [side, files] of [
		['fail', fail],
		['pass', pass],
	] as const) {
		for (const file of files) {
			mkdirSync(dirname(join(fixturesPath, side, file)), { recursive: true });
			writeFileSync(join(fixturesPath, side, file), '');
		}
	}

	return {
		rule: {
			id: 'dead-export',
			name: 'acme/dead-export',
			library: 'acme',
			set: 'code' as const,
			documentPath: 'code/architecture',
			summary: 'an export nothing else references',
			prose: '',
			checked: false,
			reviewed: true,
			defaultSeverity: StandardsSeverity.Blocking,
			defaultOptions: {},
			requires: [],
			...(example === undefined ? {} : { example }),
			fixturesPath,
		},
	};
};

describe('checkRuleExample', () => {
	test('passes a snippet holding one file a side', async () => {
		const { rule } = setupRule({ example: { kind: RuleExampleKind.Snippet }, fail: ['src/a.ts'], pass: ['src/a.ts'] });

		const problems = await checkRuleExample({ rule });

		expect(problems).toStrictEqual([]);
	});

	test('names the side where a declared snippet holds more than one file', async () => {
		const { rule } = setupRule({ example: { kind: RuleExampleKind.Snippet }, fail: ['src/a.ts'], pass: ['src/a.ts', 'package.json'] });

		const problems = await checkRuleExample({ rule });

		expect(problems).toStrictEqual(['dead-export: declares a snippet example, but fixtures/pass/ holds 2 files — a snippet is one file a side']);
	});

	test('names a repo focus file its side does not hold', async () => {
		const example = { kind: RuleExampleKind.Repo, focus: { fail: 'src/a.ts', pass: 'src/gone.ts' } } as const;
		const { rule } = setupRule({ example, fail: ['src/a.ts', 'src/b.ts'], pass: ['src/a.ts', 'src/b.ts'] });

		const problems = await checkRuleExample({ rule });

		expect(problems).toStrictEqual(['dead-export: its example focuses src/gone.ts, which fixtures/pass/ does not hold']);
	});

	test('never objects to a rule that declares no shape, since its page reads the files', async () => {
		const { rule } = setupRule({ fail: ['src/a.ts', 'src/b.ts'], pass: [] });

		const problems = await checkRuleExample({ rule });

		expect(problems).toStrictEqual([]);
	});
});
