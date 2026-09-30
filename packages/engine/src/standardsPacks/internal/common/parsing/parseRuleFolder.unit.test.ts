import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { RuleExampleKind } from '#src/contracts/views/RuleExampleKind.ts';
import { parseRuleFolder } from '#src/standardsPacks/internal/common/parsing/parseRuleFolder.ts';

/** One rule folder on disk, declaring the given front matter, with nothing else in it. */
const setupRuleFolder = ({ frontMatter }: { frontMatter: string }) => {
	const folderPath = join(mkdtempSync(join(tmpdir(), 'lightsout-rule-')), '01-internal-import-from-outside');

	mkdirSync(folderPath, { recursive: true });
	writeFileSync(join(folderPath, 'rule.md'), `---\n${frontMatter}\n---\n\nPrivate files live in internal/.\n`);

	return { folderPath };
};

describe('parseRuleFolder', () => {
	test('reads a rule the pack ships off, for a repo to opt into', async () => {
		const { folderPath } = setupRuleFolder({ frontMatter: 'summary: an internal file imported from outside\nseverity: off' });
		const problems: string[] = [];

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', problems });

		expect({ id: rule?.id, defaultSeverity: rule?.defaultSeverity, problems }).toStrictEqual({
			id: 'internal-import-from-outside',
			defaultSeverity: StandardsSeverity.Off,
			problems: [],
		});
	});

	test('defaults a rule that states no severity to advisory', async () => {
		const { folderPath } = setupRuleFolder({ frontMatter: 'summary: an internal file imported from outside' });

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', problems: [] });

		expect(rule?.defaultSeverity).toBe(StandardsSeverity.Advisory);
	});

	test('refuses a severity the pack format does not know, and drops the rule', async () => {
		const { folderPath } = setupRuleFolder({ frontMatter: 'summary: an internal file imported from outside\nseverity: loud' });
		const problems: string[] = [];

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', problems });

		expect({ rule, problemCount: problems.length }).toStrictEqual({ rule: undefined, problemCount: 1 });
	});

	test('reads the example shape a rule declares, with the file each side opens on', async () => {
		const { folderPath } = setupRuleFolder({
			frontMatter: 'summary: an internal file imported from outside\nexample:\n  kind: repo\n  focus:\n    fail: src/a.ts\n    pass: src/b.ts',
		});

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', problems: [] });

		expect(rule?.example).toStrictEqual({ kind: RuleExampleKind.Repo, focus: { fail: 'src/a.ts', pass: 'src/b.ts' } });
	});

	test('leaves the example undeclared when rule.md says nothing, so the files decide', async () => {
		const { folderPath } = setupRuleFolder({ frontMatter: 'summary: an internal file imported from outside' });

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', problems: [] });

		expect(rule).not.toHaveProperty('example');
	});

	test('refuses a repo example that names no file to open on, and drops the rule', async () => {
		const { folderPath } = setupRuleFolder({ frontMatter: 'summary: an internal file imported from outside\nexample:\n  kind: repo' });
		const problems: string[] = [];

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', problems });

		expect({ rule, problemCount: problems.length }).toStrictEqual({ rule: undefined, problemCount: 1 });
	});

	test.each([
		{ frontMatter: 'summary: an internal file imported from outside\noptions:\n  cap: 12', expected: { cap: 12 } },
		{ frontMatter: 'summary: an internal file imported from outside', expected: {} },
	])('reads the numbers a rule declares under options as its default options', async ({ frontMatter, expected }) => {
		const { folderPath } = setupRuleFolder({ frontMatter });

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', problems: [] });

		expect(rule?.defaultOptions).toStrictEqual(expected);
	});

	test('refuses an option that is not a number, and drops the rule', async () => {
		const { folderPath } = setupRuleFolder({ frontMatter: 'summary: an internal file imported from outside\noptions:\n  cap: soon' });
		const problems: string[] = [];

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', problems });

		expect({ rule, problems }).toEqual({
			rule: undefined,
			problems: [expect.stringContaining('code/modules/01-internal-import-from-outside/rule.md')],
		});
	});
});
