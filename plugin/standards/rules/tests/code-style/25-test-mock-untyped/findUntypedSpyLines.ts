import { blankStringsAndComments } from '#common/parsing/blankStringsAndComments.ts';
import { getLineNumber } from '#common/parsing/getLineNumber.ts';

/** `jest.fn` with the character that decides whether it carries a generic: `<` typed, `(` untyped. */
const spyCall = /jest\.fn\s*([<(])/g;

/** The carve-out the rule grants: a stub cast loosely to satisfy a library's own generic result type. */
const looseCast = /as unknown as|as Record</;

interface Params {
	/** One test file's text. */
	text: string;
}

/**
 * The lines holding a `jest.fn()` with no generic. The statement, not the line,
 * carries the carve-out: a stub cast for a library generic routinely spreads its
 * `as unknown as` several lines below the `jest.fn()` it wraps.
 *
 * Read with strings, templates and comments emptied out: a test that passes
 * sample code in as data is a mention of `jest.fn()` rather than a use of it.
 * Positions are unchanged, so the lines reported are the file's own.
 */
export const findUntypedSpyLines = ({ text }: Params): number[] => {
	const code = blankStringsAndComments({ text });
	const terminated = `${code};`;
	const lines: number[] = [];

	for (const match of code.matchAll(spyCall)) {
		const statement = terminated.slice(terminated.lastIndexOf(';', match.index) + 1, terminated.indexOf(';', match.index));

		if (match[1] === '(' && !looseCast.test(statement)) {
			lines.push(getLineNumber({ text: code, index: match.index }));
		}
	}

	return lines;
};
