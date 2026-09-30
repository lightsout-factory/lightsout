import type { FileExport } from '../types/FileExport.ts';

/**
 * The name position rejects `${`: a code generator's template literal can hold
 * a column-0 line like `export const ${exportName}: …`, and `${` can never open
 * a real identifier.
 */
const exportLine = /^export\s+(?:async\s+)?(const|class|function|interface|type|enum)\s+(?!\$\{)([A-Za-z0-9_$]+)/;

interface Params {
	text: string;
}

export const readFileExports = ({ text }: Params): FileExport[] => {
	const exports: FileExport[] = [];

	for (const line of text.split('\n')) {
		const [, keyword, name] = exportLine.exec(line) ?? [];

		if (keyword !== undefined && name !== undefined) {
			exports.push({ keyword, name, line });
		}
	}

	return exports;
};
