import { describe, expect, test } from '@jest/globals';
import { countPathTokens } from '#src/pipeline/moveCheck/checkMoveOnlyChanges/countPathTokens.ts';

const setupText = ({ standalonePaths }: { standalonePaths: string[] }) => {
	const text = ["import y from '../x/y.js';", 'a // b', '-1', '...rest', 'lib', '/'].join('\n');

	return { text, standalonePaths: new Set(standalonePaths) };
};

describe('countPathTokens', () => {
	test.each([
		{
			declared: ['lib'],
			inside: new Map([
				['.', 3],
				['/', 2],
				['x', 1],
				['y', 1],
				['js', 1],
				['lib', 1],
			]),
			outside: new Map([
				['import', 1],
				['y', 1],
				['from', 1],
				["'", 2],
				[';', 1],
				['a', 1],
				['/', 3],
				['b', 1],
				['-', 1],
				['1', 1],
				['.', 3],
				['rest', 1],
			]),
		},
		{
			declared: [],
			inside: new Map([
				['.', 3],
				['/', 2],
				['x', 1],
				['y', 1],
				['js', 1],
			]),
			outside: new Map([
				['import', 1],
				['y', 1],
				['from', 1],
				["'", 2],
				[';', 1],
				['a', 1],
				['/', 3],
				['b', 1],
				['-', 1],
				['1', 1],
				['.', 3],
				['rest', 1],
				['lib', 1],
			]),
		},
	])('countPathTokens: path runs and declared standalone paths are counted inside, everything else outside', ({ declared, inside, outside }) => {
		const { text, standalonePaths } = setupText({ standalonePaths: declared });

		const counted = countPathTokens({ text, standalonePaths });

		expect(counted).toStrictEqual({ inside, outside });
	});
});
