import { execFileSync } from 'node:child_process';
import { describe, expect, test } from '@jest/globals';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';

/** What a real shell hands its command after parsing: every argument on its own line. */
const parseWithShell = ({ words }: { words: string }) => {
	const printed = execFileSync('sh', ['-c', `printf '%s\\n' ${words}`], { encoding: 'utf8' });

	return printed.split('\n').slice(0, -1);
};

const awkwardArguments = ['My Projects/app-worktrees', 'lo-1;id', 'lo-1-$(touch${IFS}x)', "it's `here`", ''];

describe('quoteShellArgument', () => {
	test.each(awkwardArguments)('a shell reads %j back as the one argument it was', (argument) => {
		expect(parseWithShell({ words: quoteShellArgument({ argument }) })).toStrictEqual([argument]);
	});
});
