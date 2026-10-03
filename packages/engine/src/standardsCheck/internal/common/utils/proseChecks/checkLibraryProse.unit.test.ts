import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { checkLibraryProse } from '#src/standardsCheck/internal/common/utils/proseChecks/checkLibraryProse.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';

/** A library holding one topic and one rule in it, with the given rule prose and topic intro. */
const setupLibrary = ({ prose, intro = '# Module API' }: { prose: string; intro?: string }) => {
	const rootPath = mkdtempSync(join(tmpdir(), 'lightsout-prose-'));
	const ruleFolder = join(rootPath, 'rules', 'code', 'module-api', '10-dead-export');

	mkdirSync(ruleFolder, { recursive: true });

	const library: LoadedStandardsLibrary = {
		name: 'acme',
		formatVersion: 2,
		rootPath,
		documents: [{ set: 'code', library: 'acme', path: 'code/module-api', intro, ruleIds: ['dead-export'] }],
		rules: [
			{
				id: 'dead-export',
				name: 'acme/dead-export',
				library: 'acme',
				set: 'code',
				documentPath: 'code/module-api',
				summary: 'Code that nothing uses any more.',
				prose,
				deterministic: false,
				agent: true,
				defaultSeverity: StandardsSeverity.Advisory,
				defaultOptions: {},
				requires: [],
				fixturesPath: join(ruleFolder, 'fixtures'),
			},
		],
		packs: [],
	};

	return { library };
};

describe('checkLibraryProse', () => {
	test('names nothing for a rule with prose and no links', () => {
		const { library } = setupLibrary({ prose: '## Dead Export\n\nDelete an export nothing references.' });

		const problems = checkLibraryProse({ library });

		expect(problems).toEqual([]);
	});

	test('names a rule whose prose is only its heading', () => {
		const { library } = setupLibrary({ prose: '## Dead Export\n\n' });

		const problems = checkLibraryProse({ library });

		expect(problems).toEqual(['dead-export: rule.md has no prose under its heading — agents read the prose, so they are never told this rule']);
	});

	test('names a rule with no prose at all', () => {
		const { library } = setupLibrary({ prose: '' });

		const problems = checkLibraryProse({ library });

		expect(problems).toEqual(['dead-export: rule.md has no prose under its heading — agents read the prose, so they are never told this rule']);
	});

	test('names a link in rule prose that resolves against the rule folder and is not there', () => {
		const { library } = setupLibrary({ prose: '## Dead Export\n\nSee [the old document](../functions.md).' });

		const problems = checkLibraryProse({ library });

		expect(problems).toEqual(['dead-export: rule.md links to ../functions.md, which does not exist']);
	});

	test('names a link in a topic intro that resolves against the topic folder and is not there', () => {
		const { library } = setupLibrary({ prose: '## Dead Export\n\nDelete it.', intro: '# Module API\n\nSee [mocks](./unit-testing.md#mocks).' });

		const problems = checkLibraryProse({ library });

		expect(problems).toEqual(['code/module-api: topic.md links to ./unit-testing.md#mocks, which does not exist']);
	});
});
