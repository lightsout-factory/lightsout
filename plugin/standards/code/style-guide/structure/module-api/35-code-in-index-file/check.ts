import type { RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildRawFinding } from '../../../../../common/findings/buildRawFinding.ts';
import { getFrameworkCarveOuts } from '../../../../../common/frameworks/getFrameworkCarveOuts.ts';
import { getPathCarveOut } from '../../../../../common/frameworks/getPathCarveOut.ts';
import { isFrameworkLoadedFile } from '../../../../../common/frameworks/isFrameworkLoadedFile.ts';
import { getBaseName } from '../../../../../common/paths/getBaseName.ts';

/** Every index file, wherever it stands: a package's entry holds no code any more than a folder's does. */
const isIndexFile = ({ path }: { path: string }) => /^index\.tsx?$/.test(getBaseName({ path }));

/** `export *` passes here too: how a barrel re-exports is barrel-star's objection, not this rule's. */
const isReExport = ({ statement, compiler }: { statement: ts.Statement; compiler: typeof ts }) =>
	compiler.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined;

const buildFileFindings = ({ input }: { input: SyntaxTreeInput }) => {
	const findings: RawStandardsFinding[] = [];
	const carveOuts = getFrameworkCarveOuts({ dependencies: input.dependencies });

	for (const [path, tree] of input.trees) {
		// A file-based router MANDATES an index route file whose content is a route
		// definition, and a convention-resolved entry file is code by definition;
		// demanding re-export lines of either asks for a file the framework could
		// not use.
		if (isFrameworkLoadedFile({ path, carveOut: getPathCarveOut({ carveOuts, path }) })) {
			continue;
		}

		if (isIndexFile({ path })) {
			const offending = tree.statements.filter((statement) => !isReExport({ statement, compiler: input.compiler }));
			const [first] = offending;

			if (first !== undefined) {
				const line = tree.getLineAndCharacterOfPosition(first.getStart(tree)).line + 1;

				findings.push(
					buildRawFinding({
						rule: 'code-in-index-file',
						files: [{ path }],
						detail: `${offending.length} statement(s) other than re-export lines, the first at line ${line}`,
						guidance: 'An index file is the package’s doorway — re-export lines only. Executable code belongs in a named entry file such as main.ts.',
					}),
				);
			}
		}
	}

	return findings;
};

export const check: StandardsCheckModule = {
	inputKind: 'syntax-tree',
	// Barrels in this codebase hold multi-line re-export statements, so the
	// verdict needs parsed statements — a line scan cannot tell the middle of an
	// `export type { … } from` block from a declaration.
	run: ({ input }): RawStandardsFinding[] => (input.kind === 'syntax-tree' ? buildFileFindings({ input }) : []),
};
