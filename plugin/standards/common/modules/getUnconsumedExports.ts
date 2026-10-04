import { readPackageEntries } from '../checkInput/readPackageEntries.ts';
import { readFileExports } from '../parsing/readFileExports.ts';
import { isIndexFile } from '../paths/isIndexFile.ts';
import { isTestFile } from '../paths/isTestFile.ts';
import type { UnconsumedExport } from '../types/UnconsumedExport.ts';
import { isPackageEntry } from './isPackageEntry.ts';

/**
 * An index file counts only if it exports. An entry index that only
 * imports and runs is an ordinary consumer — counting it reads
 * every command a dispatcher invokes as "public but unconsumed".
 */
const isExportingIndex = ({ file, text }: { file: string; text: string }) => isIndexFile({ path: file }) && /^export\b/m.test(text);

interface Params {
	/** Files in scope — only these are judged, though everything in `contents` may reference them. */
	files: string[];
	/** Text for every file in scope and every reference file. */
	contents: Map<string, string>;
	/** Repo-relative standards pack roots, so a pack's `tests/` document set is not read as test code. */
	standardsLibraries: string[];
}

/**
 * Whole-word name counting, which is honest here because one-export-per-file
 * makes every export a distinct searchable name. Conservative by construction:
 * a name mentioned in a comment or a string counts as a reference, so calling a
 * live export unconsumed is rare. A test's mention counts like any other: an
 * export its tests still use is not dead. Names under four characters are skipped —
 * they collide with ordinary words too often to measure. Index files and test
 * files declare nothing that is judged: an index file's names belong to the file it
 * re-exports, and a test's helpers are the test's own.
 *
 * A package's entry listing a name is a use of it: other packages read the
 * entry, and they are invisible here. A folder's index file listing it is not —
 * every import names the declaring file, so a folder index file's list is a name
 * nothing reads through, and counting it would hide a dead export behind it.
 */
export const getUnconsumedExports = ({ files, contents, standardsLibraries }: Params): UnconsumedExport[] => {
	const scope = new Set(files);
	const entries = readPackageEntries({ contents });
	const declarations: Array<{ name: string; file: string }> = [];

	for (const [file, text] of contents) {
		if (!scope.has(file) || isIndexFile({ path: file }) || isTestFile({ path: file, standardsLibraries })) {
			continue;
		}

		for (const { name } of readFileExports({ text })) {
			if (name.length >= 4) {
				declarations.push({ name, file });
			}
		}
	}

	const unconsumed: UnconsumedExport[] = [];

	for (const { name, file } of declarations) {
		const pattern = new RegExp(`\\b${name}\\b`);
		let referenced = false;

		for (const [other, text] of contents) {
			if (other === file || !pattern.test(text)) {
				continue;
			}

			const isFolderIndex =
				!isTestFile({ path: other, standardsLibraries }) && isExportingIndex({ file: other, text }) && !isPackageEntry({ path: other, entries });

			referenced ||= !isFolderIndex;
		}

		if (!referenced) {
			unconsumed.push({ file, name });
		}
	}

	return unconsumed;
};
