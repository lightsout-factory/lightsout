import { describe, expect, test } from '@jest/globals';
import { setupFileListInput } from '@lightsout/standards-testkit';
import { readPathLists } from './readPathLists.ts';

describe('readPathLists', () => {
	test('reads the paths from a file-list input', () => {
		const input = setupFileListInput({ source: ['src/app.ts'], tests: ['src/app.unit.test.ts'] });

		expect(readPathLists({ input })).toStrictEqual({
			files: ['src/app.ts', 'src/app.unit.test.ts'],
			tests: ['src/app.unit.test.ts'],
			standardsLibraries: [],
		});
	});

	test('carries the pack roots the input declares, rather than a fixed empty list', () => {
		const input = setupFileListInput({ source: ['standards/tests/code-style/10-rule/check.ts'], standardsLibraries: ['standards'] });

		expect(readPathLists({ input })).toStrictEqual({
			files: ['standards/tests/code-style/10-rule/check.ts'],
			tests: [],
			standardsLibraries: ['standards'],
		});
	});

	test('yields empty lists when the input is missing, rather than refusing', () => {
		expect(readPathLists({ input: undefined })).toStrictEqual({ files: [], tests: [], standardsLibraries: [] });
	});
});
