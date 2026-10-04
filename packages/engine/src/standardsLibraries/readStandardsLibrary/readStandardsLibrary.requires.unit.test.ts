import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary/readStandardsLibrary.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

/** A temp standards library named `house` holding the given library-relative files. */
const writeLibrary = ({ files }: { files: Record<string, string> }) => {
	const packPath = mkdtempSync(join(tmpdir(), 'lightsout-library-'));
	const allFiles = { 'lightsout-standards.json': '{ "name": "house", "formatVersion": 2 }\n', 'rules/code/style/topic.md': '# Style\n', ...files };

	for (const [path, content] of Object.entries(allFiles)) {
		const absolutePath = join(packPath, path);

		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}

	return packPath;
};

/** One rule folder's files: its markdown plus the fixture pair every rule ships. */
const ruleFiles = ({ path, markdown }: { path: string; markdown: string }) => ({
	[`${path}/rule.md`]: markdown,
	[`${path}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
	[`${path}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
});

/** A library whose rule `a` requires its sibling `b` by short id, and whose rule `b` names no requires. */
const setupSiblingRequires = () => {
	const packPath = writeLibrary({
		files: {
			...ruleFiles({ path: 'rules/code/style/01-a', markdown: '---\nsummary: rule a\nchecks: agent\nrequires:\n  - b\n---\n\nFollow b.\n' }),
			...ruleFiles({ path: 'rules/code/style/02-b', markdown: '---\nsummary: rule b\nchecks: agent\n---\n\nProse.\n' }),
		},
	});

	return { packPath };
};

/** A library whose two rules each require a name that matches no rule in it. */
const setupUnknownRequires = () => {
	const packPath = writeLibrary({
		files: {
			...ruleFiles({ path: 'rules/code/style/01-a', markdown: '---\nsummary: rule a\nchecks: agent\nrequires:\n  - no-such-first\n---\n\nProse.\n' }),
			...ruleFiles({ path: 'rules/code/style/02-b', markdown: '---\nsummary: rule b\nchecks: agent\nrequires:\n  - no-such-second\n---\n\nProse.\n' }),
		},
	});

	return { packPath };
};

describe('readStandardsLibrary requires', () => {
	test('loads rule.md requires as full rule names', async () => {
		const { packPath } = setupSiblingRequires();

		const library = await readStandardsLibrary({ packPath });

		// the short id `b` becomes the full name house/b; a rule with no requires key loads an empty list
		expect(library.rules.map((rule) => [rule.name, rule.requires])).toStrictEqual([
			['house/a', ['house/b']],
			['house/b', []],
		]);
	});

	test('throws one load error naming every requires entry that matches no rule', async () => {
		const { packPath } = setupUnknownRequires();

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		// one error for the whole load, listing both unresolved entries with the rule folders that wrote them: ${error.message}
		expect({
			startsWithLoadFailure: error.message.startsWith(`standards pack failed to load (${packPath}):`),
			namesFirstRule: error.message.includes('code/style/01-a'),
			namesFirstEntry: error.message.includes('no-such-first'),
			namesSecondRule: error.message.includes('code/style/02-b'),
			namesSecondEntry: error.message.includes('no-such-second'),
		}).toStrictEqual({ startsWithLoadFailure: true, namesFirstRule: true, namesFirstEntry: true, namesSecondRule: true, namesSecondEntry: true });
	});
});
