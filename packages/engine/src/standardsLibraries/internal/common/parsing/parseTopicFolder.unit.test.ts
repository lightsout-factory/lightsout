import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { parseTopicFolder } from '#src/standardsLibraries/internal/common/parsing/parseTopicFolder.ts';

/** One topic folder on disk holding the given topic.md and one rule folder per name, written in reverse name order. */
const setupTopicFolder = ({ topicMarkdown, ruleFolders = [] }: { topicMarkdown: string; ruleFolders?: string[] }) => {
	const folderPath = join(mkdtempSync(join(tmpdir(), 'lightsout-topic-')), 'react');

	mkdirSync(folderPath, { recursive: true });
	writeFileSync(join(folderPath, 'topic.md'), topicMarkdown);

	for (const name of [...ruleFolders].reverse()) {
		mkdirSync(join(folderPath, name), { recursive: true });
		writeFileSync(join(folderPath, name, 'rule.md'), `---\nsummary: a rule named ${name}\n---\n\nKeep it tidy.\n`);
	}

	return { folderPath };
};

/** Parses one topic folder of library acme at `code/architecture/react`, returning the result and the problems recorded against it. */
const parseCollecting = async ({ folderPath }: { folderPath: string }) => {
	const problems: string[] = [];
	const parsed = await parseTopicFolder({ folderPath, documentPath: 'code/architecture/react', set: 'code', library: 'acme', problems });

	return { parsed, problems };
};

describe('parseTopicFolder', () => {
	test('refuses any front matter key in topic.md, naming the file and the key', async () => {
		const { folderPath } = setupTopicFolder({ topicMarkdown: '---\nchannel: react\n---\n\n# React\n\nComponents and hooks.\n' });

		const { parsed, problems } = await parseCollecting({ folderPath });

		expect({ parsed, problems }).toEqual({
			parsed: undefined,
			problems: [expect.stringMatching(/^code\/architecture\/react\/topic\.md: .*channel/)],
		});
	});

	test('loads a topic with no front matter and stamps no channel on the topic or its rules', async () => {
		const { folderPath } = setupTopicFolder({
			topicMarkdown: '# React\n\nComponents and hooks share this background.\n',
			ruleFolders: ['01-component-size', '02-hook-naming'],
		});

		const { parsed, problems } = await parseCollecting({ folderPath });

		expect({
			problems,
			intro: parsed?.document.intro,
			ruleIds: parsed?.document.ruleIds,
			loadedRuleIds: parsed?.rules.map((rule) => rule.id),
			topicHasChannel: parsed === undefined ? undefined : Object.hasOwn(parsed.document, 'channel'),
			rulesHaveChannel: parsed?.rules.map((rule) => Object.hasOwn(rule, 'channel')),
		}).toStrictEqual({
			problems: [],
			intro: '# React\n\nComponents and hooks share this background.',
			ruleIds: ['component-size', 'hook-naming'],
			loadedRuleIds: ['component-size', 'hook-naming'],
			topicHasChannel: false,
			rulesHaveChannel: [false, false],
		});
	});
});
