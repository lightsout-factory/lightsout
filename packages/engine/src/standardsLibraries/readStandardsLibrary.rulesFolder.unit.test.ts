import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';

/** The root file every valid library carries. */
const rootFile = { 'lightsout-standards.json': '{ "name": "acme", "formatVersion": 2 }\n' };

/** One topic folder holding one rule folder, with the fixture pair every rule ships. */
const topicFiles = ({ path, rule }: { path: string; rule: string }) => ({
	[`${path}/topic.md`]: '# Topic\n',
	[`${path}/01-${rule}/rule.md`]: `---\nsummary: ${rule} summary\nchecks: agent\n---\n\nProse.\n`,
	[`${path}/01-${rule}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
	[`${path}/01-${rule}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
});

/** A temp library holding the given library-relative files. */
const setupLibrary = ({ files }: { files: Record<string, string> }) => {
	const packPath = mkdtempSync(join(tmpdir(), 'lightsout-library-'));

	for (const [path, content] of Object.entries({ ...rootFile, ...files })) {
		const absolutePath = join(packPath, path);

		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}

	return { packPath };
};

describe('readStandardsLibrary — where the topic trees sit', () => {
	test('walks only the rules folder when the library root holds both a rules folder and a root-level code folder', async () => {
		const { packPath } = setupLibrary({
			files: {
				...topicFiles({ path: 'rules/code/style', rule: 'short-functions' }),
				...topicFiles({ path: 'code/legacy', rule: 'legacy-rule' }),
			},
		});

		const library = await readStandardsLibrary({ packPath });
		const topicPaths = library.documents.map((topic) => topic.path);
		const ruleIds = library.rules.map((rule) => rule.id);

		expect({ topicPaths, ruleIds }).toStrictEqual({ topicPaths: ['code/style'], ruleIds: ['short-functions'] });
	});

	test('loads topics from rules/code and rules/tests and records their paths without the rules segment', async () => {
		const { packPath } = setupLibrary({
			files: {
				...topicFiles({ path: 'rules/code/style', rule: 'short-functions' }),
				...topicFiles({ path: 'rules/tests/unit-testing', rule: 'mock-prefix' }),
			},
		});

		const library = await readStandardsLibrary({ packPath });
		const topics = library.documents.map((topic) => ({ set: topic.set, path: topic.path, ruleIds: topic.ruleIds }));
		const rules = library.rules.map((rule) => ({ id: rule.id, set: rule.set, documentPath: rule.documentPath }));

		expect({ topics, rules }).toStrictEqual({
			topics: [
				{ set: 'code', path: 'code/style', ruleIds: ['short-functions'] },
				{ set: 'tests', path: 'tests/unit-testing', ruleIds: ['mock-prefix'] },
			],
			rules: [
				{ id: 'short-functions', set: 'code', documentPath: 'code/style' },
				{ id: 'mock-prefix', set: 'tests', documentPath: 'tests/unit-testing' },
			],
		});
	});

	test('refuses a library whose topic folders sit at its root instead of under rules', async () => {
		const { packPath } = setupLibrary({
			files: {
				...topicFiles({ path: 'code/style', rule: 'short-functions' }),
			},
		});

		const loading = readStandardsLibrary({ packPath });

		await expect(loading).rejects.toThrow(/^- (?=.*\bno\b)(?=.*topic)(?=.*rules\/code)(?=.*rules\/tests).*$/m);
	});
});
