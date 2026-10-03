import { describe, expect, test } from '@jest/globals';
import { setupFileTextInput, setupSyntaxTreeInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('index-file-contents check', () => {
	test('asks for the file text and the parsed trees: the text shows a star re-export, the tree a statement that is no re-export', () => {
		expect(check.inputKinds).toStrictEqual(['file-text', 'syntax-tree']);
	});

	test('reports both halves in one run: a star re-export and code, each once', async () => {
		const source = "export * from './feature/renderGreeting';\n\nconsole.log('entry loaded');\n";
		const inputs = {
			'file-text': setupFileTextInput({ contents: [['src/index.ts', source]] }),
			'syntax-tree': setupSyntaxTreeInput({ sources: [['src/index.ts', source]] }),
		};

		const findings = await check.run({ inputs, options: {} });

		expect(findings.map(({ detail }) => detail)).toStrictEqual([
			"'./feature/renderGreeting' re-exported with `export *`",
			'1 statement(s) other than re-export lines, the first at line 3',
		]);
	});

	test('answers nothing when both inputs are missing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
