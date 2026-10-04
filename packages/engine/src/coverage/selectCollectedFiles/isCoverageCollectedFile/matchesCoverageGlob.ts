const rootDirToken = '<rootDir>/';
const currentDirToken = './';

// `[`/`]` are character classes, `(`/`)` are extglob, `\` is an escape — each
// would change what the pattern means, and guessing could take teeth away from
// the gate.
const unsupportedSyntax = /[[\]()\\]/;

// Both tokens mean "from the root the path side is already relative to". They
// are stripped before anything else looks at the pattern, because `<` and `>`
// would otherwise be matched as ordinary characters and every such pattern
// would silently match nothing at all.
const normalisePattern = ({ pattern }: { pattern: string }) => {
	let result = pattern;

	while (result.startsWith(rootDirToken) || result.startsWith(currentDirToken)) {
		result = result.startsWith(rootDirToken) ? result.slice(rootDirToken.length) : result.slice(currentDirToken.length);
	}

	return result;
};

// Only single-level `{a,b}` alternation is implemented: a nested `{`, an
// unmatched `{`, or a stray `}` all make the pattern undecidable.
const hasUnsupportedBraces = ({ pattern }: { pattern: string }) => {
	let depth = 0;
	let invalid = false;

	for (const character of pattern) {
		if (character === '{') {
			depth += 1;
		}

		if (character === '}') {
			depth -= 1;
		}

		invalid = invalid || depth > 1 || depth < 0;
	}

	return invalid || depth !== 0;
};

const escapeLiteral = ({ character }: { character: string }) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toExpression = ({ pattern }: { pattern: string }) => {
	let expression = '';
	let index = 0;

	while (index < pattern.length) {
		const character = pattern[index];

		if (character === '*' && pattern[index + 1] === '*' && pattern[index + 2] === '/') {
			// `**/` spans any number of path segments, including none — which is
			// what makes `**/*.ts` match a file sitting at the root.
			expression += '(?:[^/]+/)*';
			index += 3;
		} else if (character === '*' && pattern[index + 1] === '*') {
			expression += '.*';
			index += 2;
		} else if (character === '*') {
			expression += '[^/]*';
			index += 1;
		} else if (character === '?') {
			expression += '[^/]';
			index += 1;
		} else if (character === '{') {
			const close = pattern.indexOf('}', index);
			const alternatives = pattern.slice(index + 1, close).split(',');

			expression += `(?:${alternatives.map((alternative) => toExpression({ pattern: alternative })).join('|')})`;
			index = close + 1;
		} else {
			expression += escapeLiteral({ character });
			index += 1;
		}
	}

	return expression;
};

interface Params {
	/** Any leading `!` already stripped by the caller. */
	pattern: string;
	/** rootDir-relative, posix form, no leading `./`. */
	path: string;
}

/**
 * `undefined` means "cannot decide", never "no match": unsupported syntax
 * (extglob, character classes, nested braces, backslash escapes) and an
 * expression that will not compile both answer it.
 *
 * Never throws: a throw would propagate out of the shared predicate into both
 * the execution gate and the write-tests step and end the run.
 */
export const matchesCoverageGlob = ({ pattern, path }: Params): boolean | undefined => {
	const normalised = normalisePattern({ pattern });

	if (unsupportedSyntax.test(normalised) || hasUnsupportedBraces({ pattern: normalised })) {
		return undefined;
	}

	try {
		// Jest's globs are case-sensitive, and a glob describes the whole path.
		return new RegExp(`^${toExpression({ pattern: normalised })}$`).test(path);
	} catch {
		return undefined;
	}
};
