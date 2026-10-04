// The gap before `from` cannot cross a semicolon or quote, so the lazy span
// can never swallow real code.
const importSpan = /^[ \t]*import\b(?:[^;'"]*?from\s*)?(['"])[^'"\n]+\1\s*;?/gm;

interface Params {
	text: string;
}

/** Preserves every newline, so duplicate-block detection still reports true line numbers. */
export const blankImportSpans = ({ text }: Params): string => {
	return text.replace(importSpan, (span) => span.replace(/[^\n]/g, ''));
};
