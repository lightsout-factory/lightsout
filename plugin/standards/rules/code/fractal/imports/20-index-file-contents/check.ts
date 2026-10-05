import type { FileTextInput, RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { readFileTexts } from '#common/checkInput/readFileTexts.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { readIndexExports } from '#common/modules/readIndexExports.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { isIndexFile } from '#common/paths/isIndexFile.ts';

/** Every index file, wherever it stands: a package's entry holds no code any more than a folder's does. */
const isTypeScriptIndexFile = ({ path }: { path: string }) => /^index\.tsx?$/.test(getBaseName({ path }));

/** `export *` passes here: the star is the file-text half's finding, so one line never reports twice. */
const isReExport = ({ statement, compiler }: { statement: ts.Statement; compiler: typeof ts }) =>
	compiler.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined;

/**
 * Parsed statements rather than a line scan, because a multi-line
 * `export type { … } from` block cannot be told from a declaration by its
 * middle lines.
 */
const findCodeInIndexFiles = ({ input }: { input: SyntaxTreeInput | undefined }): RawStandardsFinding[] => {
	if (input === undefined) {
		return [];
	}

	const findings: RawStandardsFinding[] = [];

	for (const [path, tree] of input.trees) {
		if (isTypeScriptIndexFile({ path })) {
			const offending = tree.statements.filter((statement) => !isReExport({ statement, compiler: input.compiler }));
			const [first] = offending;

			if (first !== undefined) {
				const line = tree.getLineAndCharacterOfPosition(first.getStart(tree)).line + 1;

				findings.push(
					buildRawFinding({
						rule: 'index-file-contents',
						files: [{ path }],
						detail: `${offending.length} statement(s) other than re-export lines, the first at line ${line}`,
						guidance: 'An index file holds re-export lines only. Put executable code in a named entry file such as main.ts.',
					}),
				);
			}
		}
	}

	return findings;
};

/**
 * `export *` publishes whatever the target happens to export, the opposite of
 * a contract listing what consumers may use. A package's entry is where that
 * contract matters most, so every index file is judged, the entry included.
 */
const findStarReExports = ({ input }: { input: FileTextInput | undefined }): RawStandardsFinding[] => {
	const { files, contents } = readFileTexts({ input });
	const fileSet = new Set(files);

	return files
		.filter((path) => isIndexFile({ path }))
		.flatMap((indexPath) => {
			const stars = readIndexExports({ indexPath, contents, files: fileSet }).filter(({ star }) => star);

			return stars.length === 0
				? []
				: [
						buildRawFinding({
							rule: 'index-file-contents',
							files: [{ path: indexPath }],
							detail: `${stars.map(({ specifier }) => `'${specifier}'`).join(', ')} re-exported with \`export *\``,
							guidance: 'An index file is a package’s public API — list named re-exports instead.',
						}),
					];
		});
};

export const check: StandardsCheckModule = {
	inputKinds: ['file-text', 'syntax-tree'],
	/** The file text says which index files re-export with a star; the parsed statements say which hold code. */
	run: ({ inputs }): RawStandardsFinding[] => [...findStarReExports({ input: inputs['file-text'] }), ...findCodeInIndexFiles({ input: inputs['syntax-tree'] })],
};
