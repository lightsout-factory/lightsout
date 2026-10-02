import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from '@jest/globals';
import { runSprawlDriver } from '#tests/helpers/sprawl/runSprawlDriver.ts';
import { seedSprawlRepo } from '#tests/helpers/sprawl/seedSprawlRepo.ts';

// Where the sprawl animation's five numbers come from. The page tells a reader
// what this repo's caps are, so every one of them is read from the standards
// pack's own rule file — and a rule file that cannot answer has to stop the
// build rather than let a plausible number ship.

const fileSizeRule = 'rules/code/fractal/size/10-file-size/rule.md';
const functionSizeRule = 'rules/code/fractal/size/05-function-size/rule.md';
const repos: string[] = [];

const setupCapsRepo = ({ rules }: { rules?: Record<string, string | undefined> } = {}) => {
	const cwd = seedSprawlRepo({ rules });

	repos.push(cwd);

	return { cwd };
};

/** The script's answer, or the message it refused with. */
const readCaps = ({ cwd }: { cwd: string }) =>
	runSprawlDriver<{ caps?: Record<string, number>; error?: string }>({
		cwd,
		body: [
			"import { readSprawlCaps } from './scripts/readSprawlCaps.mjs';",
			'',
			'try {',
			'\treport({ caps: readSprawlCaps({ repoRoot: import.meta.dirname }) });',
			'} catch (error) {',
			'\treport({ error: error.message });',
			'}',
		].join('\n'),
	});

afterAll(() => {
	for (const cwd of repos) {
		rmSync(join(cwd, '..'), { recursive: true, force: true });
	}
});

describe('readSprawlCaps', () => {
	test('reads all five caps from the pack rule files that own them', () => {
		const { cwd } = setupCapsRepo();

		const result = readCaps({ cwd });

		expect(result.caps).toStrictEqual({ file: 100, tsxFile: 120, function: 30, testFile: 400, folderCensus: 3 });
	});

	test('spells the caps in the order the dataset declares them, so a rebuild cannot reshuffle the JSON', () => {
		const { cwd } = setupCapsRepo();

		const result = readCaps({ cwd });

		expect(Object.keys(result.caps ?? {})).toStrictEqual(['file', 'tsxFile', 'function', 'testFile', 'folderCensus']);
	});

	test('stops reading at the first line that is not an option, so prose below the front matter cannot be mistaken for a cap', () => {
		const { cwd } = setupCapsRepo({
			rules: { [fileSizeRule]: ['---', 'options:', '  file: 100', '  tsxFile: 120', '---', '', '  tsxFile: 999', ''].join('\n') },
		});

		const result = readCaps({ cwd });

		expect(result.caps).toEqual(expect.objectContaining({ tsxFile: 120 }));
	});

	test('refuses when a rule file carries no options block', () => {
		const { cwd } = setupCapsRepo({ rules: { [functionSizeRule]: ['---', 'summary: "no numbers here"', '---', ''].join('\n') } });

		const result = readCaps({ cwd });

		expect(result.error).toMatch(/05-function-size\/rule\.md has no options: block/);
	});

	test('refuses when an options block is missing the key the cap is read from', () => {
		const { cwd } = setupCapsRepo({ rules: { [fileSizeRule]: ['---', 'options:', '  file: 100', '---', ''].join('\n') } });

		const result = readCaps({ cwd });

		expect(result.error).toMatch(/has no numeric `tsxFile` option/);
	});

	test('refuses when an option is present but not a number', () => {
		const { cwd } = setupCapsRepo({ rules: { [functionSizeRule]: ['---', 'options:', '  function: soon', '---', ''].join('\n') } });

		const result = readCaps({ cwd });

		expect(result.error).toMatch(/has no numeric `function` option/);
	});

	test("reads the caps from each rule file's options block, and refuses a file that has none", () => {
		const optionsRule = ({ options }: { options: string[] }) => ['---', 'summary: "a rule"', 'options:', ...options, '---', '', 'prose below', ''].join('\n');
		const { cwd: optionsCwd } = setupCapsRepo({
			rules: {
				[fileSizeRule]: optionsRule({ options: ['  file: 110', '  tsxFile: 130'] }),
				[functionSizeRule]: optionsRule({ options: ['  function: 35'] }),
				'rules/tests/fractal/15-test-file-size/rule.md': optionsRule({ options: ['  testFile: 410'] }),
				'rules/code/fractal/size/15-folder-size/rule.md': optionsRule({ options: ['  cap: 4'] }),
			},
		});
		const { cwd: missingCwd } = setupCapsRepo({
			rules: { [functionSizeRule]: ['---', 'summary: "no numbers here"', 'settings:', '  function: 30', '---', ''].join('\n') },
		});

		const read = readCaps({ cwd: optionsCwd });
		const refused = readCaps({ cwd: missingCwd });

		expect({ caps: read.caps, error: refused.error }).toEqual({
			caps: { file: 110, tsxFile: 130, function: 35, testFile: 410, folderCensus: 4 },
			error: expect.stringMatching(/05-function-size\/rule\.md has no options: block/),
		});
	});

	test('refuses when a rule file the caps come from is not there at all', () => {
		const { cwd } = setupCapsRepo({ rules: { [functionSizeRule]: undefined } });

		const result = readCaps({ cwd });

		expect(result.error).toMatch(/05-function-size/);
	});

	test('refuses when the cap rule files sit at the library root instead of under rules', () => {
		const rootRule = ({ options }: { options: string[] }) => ['---', 'summary: "a rule"', 'options:', ...options, '---', '', 'prose below', ''].join('\n');
		const { cwd } = setupCapsRepo({
			rules: {
				'rules/code/fractal/size/10-file-size/rule.md': undefined,
				'rules/code/fractal/size/05-function-size/rule.md': undefined,
				'rules/tests/fractal/15-test-file-size/rule.md': undefined,
				'rules/code/fractal/size/15-folder-size/rule.md': undefined,
				'code/fractal/size/10-file-size/rule.md': rootRule({ options: ['  file: 100', '  tsxFile: 120'] }),
				'code/fractal/size/05-function-size/rule.md': rootRule({ options: ['  function: 30'] }),
				'tests/fractal/15-test-file-size/rule.md': rootRule({ options: ['  testFile: 400'] }),
				'code/fractal/size/15-folder-size/rule.md': rootRule({ options: ['  cap: 3'] }),
			},
		});

		const result = readCaps({ cwd });

		expect({ carriesCaps: Object.hasOwn(result, 'caps'), error: result.error }).toEqual({
			carriesCaps: false,
			error: expect.stringMatching(/rules\/code\/fractal\/size\/10-file-size\/rule\.md/),
		});
	});
});
