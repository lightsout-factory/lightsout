import type { RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';

const isExported = ({ statement, compiler }: { statement: ts.Statement; compiler: typeof ts }) =>
	(compiler.canHaveModifiers(statement) ? (compiler.getModifiers(statement) ?? []) : []).some(
		(modifier) => modifier.kind === compiler.SyntaxKind.ExportKeyword,
	);

/**
 * Only top-level statements are read: a nested function is not exported, and
 * the rule is about the file's public contract.
 *
 * A generic signature is left alone, since its type parameters are the
 * contract, and an arrow whose variable is annotated is already pinned. The
 * document's other two exceptions are decided by the caller.
 */
const getUnannotated = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => {
	const missing: string[] = [];

	for (const statement of sourceFile.statements) {
		if (!isExported({ statement, compiler })) {
			continue;
		}

		if (compiler.isFunctionDeclaration(statement) && statement.name !== undefined && statement.type === undefined && statement.typeParameters === undefined) {
			missing.push(statement.name.text);
		}

		if (compiler.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				const initializer = declaration.initializer;
				const isPlainArrow =
					initializer !== undefined &&
					(compiler.isArrowFunction(initializer) || compiler.isFunctionExpression(initializer)) &&
					initializer.type === undefined &&
					initializer.typeParameters === undefined;

				if (isPlainArrow && declaration.type === undefined && compiler.isIdentifier(declaration.name)) {
					missing.push(declaration.name.text);
				}
			}
		}
	}

	return missing;
};

const isQueryOptionsFactory = ({ path }: { path: string }) => path.split('/').slice(0, -1).includes('queries');

/**
 * An allow-list rather than extensions to skip. `.tsx` is the document's first
 * exception, framework components. JavaScript has no syntax for the annotation,
 * so every hit would be a finding nobody could fix, and these standards run at
 * full strength on JavaScript-only repos.
 *
 * A `queries/` folder is the fourth exception, decided by path because a
 * query-options factory's contract is its inferred `queryOptions` type, which
 * the declaration's syntax does not show.
 */
const isAnnotatable = ({ path }: { path: string }) => /\.(ts|mts|cts)$/.test(path) && !isQueryOptionsFactory({ path });

/** One finding per file: annotating the exports of a file is one pass through it. */
const buildFileFindings = ({ input }: { input: SyntaxTreeInput }) => {
	const findings: RawStandardsFinding[] = [];

	for (const [path, tree] of input.trees) {
		const missing = isAnnotatable({ path }) ? getUnannotated({ sourceFile: tree, compiler: input.compiler }) : [];

		if (missing.length > 0) {
			findings.push(
				buildRawFinding({
					rule: 'explicit-return-type',
					files: [{ path }],
					detail: missing.map((name) => `exported '${name}' declares no return type`).join('; '),
					guidance: 'Declare the return type — it is the output half of the contract, and it fails at the definition site rather than in a consumer.',
				}),
			);
		}
	}

	return findings;
};

export const check: StandardsCheckModule = {
	inputKinds: ['syntax-tree'],
	// The annotation's absence is a fact of the declaration, and the two
	// exceptions that survive here — generics and an already-typed variable —
	// are facts of the same node.
	run: ({ inputs }): RawStandardsFinding[] => {
		const input = inputs['syntax-tree'];

		return input === undefined ? [] : buildFileFindings({ input });
	},
};
