import { readFileExports } from '#common/parsing/readFileExports.ts';
import type { FileExport } from '#common/types/FileExport.ts';
import { CodeKind } from './CodeKind.ts';

interface Params {
	text: string;
}

/** A `const` holding an arrow function or a function expression. */
const functionValue = /=\s*(?:async\s+)?(?:<[^=]*>\s*)?(?:\(|function\b|[A-Za-z_$][\w$]*\s*=>)/;

const isFunction = ({ keyword, line }: FileExport) => keyword === 'function' || keyword === 'class' || (keyword === 'const' && functionValue.test(line));

/**
 * A file with a type and a value goes by its value, and a value not written as
 * a function or a class is a constant, one built by a call included: what a
 * call returns cannot be read from the line.
 */
export const getCodeKind = ({ text }: Params): CodeKind | undefined => {
	const exports = readFileExports({ text });

	if (exports.some(isFunction)) {
		return CodeKind.Function;
	}

	if (exports.some(({ keyword }) => keyword === 'const' || keyword === 'enum')) {
		return CodeKind.Constant;
	}

	return exports.length > 0 ? CodeKind.Type : undefined;
};
