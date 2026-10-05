import { expect, test } from '@jest/globals';
import { usage } from '#src/common/constants/usage.ts';
import { usageFixture } from '#tests/helpers/usageFixture.ts';

// `usage` is no longer a hand-written block: it is what the command catalog's
// renderer returns, evaluated once when the module loads. Every CLI path that
// prints help — a missing required flag, an unknown command, `help` itself —
// prints this string, so the whole block is pinned against the same
// hand-written fixture the renderer is held to. A `usage.ts` that grew its own
// copy of the text, or lost a command the catalog carries, fails here.

test('usage: the text every CLI help path prints is the checked-in --help block, byte for byte', () => {
	expect(usage).toBe(usageFixture);
});

// A note column (three or more spaces, then a parenthesised note) follows a
// line's flags, so the last flag is read from the line with its note removed.
// The pattern needs a space or line end after the command, so `implement-direct`
// is not one of the lines read.
const readLastFlags = ({ text }: { text: string }) => {
	const offering = text.split('\n').filter((line) => /^ {2}lightsout (implement|resume|queue)( |$)/.test(line));

	return offering.map((line) => {
		const body = line.replace(/ {3,}\(.*\)$/, '');

		return { command: body.trim().split(' ').slice(0, 2).join(' '), lastFlag: body.slice(body.lastIndexOf(' [') + 1) };
	});
};

test('usage: implement, resume and queue each offer --detach as their last optional flag', () => {
	const lastFlags = readLastFlags({ text: usage });

	expect(lastFlags).toStrictEqual([
		{ command: 'lightsout implement', lastFlag: '[--detach]' },
		{ command: 'lightsout implement', lastFlag: '[--detach]' },
		{ command: 'lightsout resume', lastFlag: '[--detach]' },
		{ command: 'lightsout queue', lastFlag: '[--detach]' },
	]);
});
