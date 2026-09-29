import type ts from 'typescript';

interface Params {
	/** Only the script flavor is taken from it. */
	path: string;
	content: string;
	compiler: typeof ts;
}

const declaredNames = ({ statement, compiler }: { statement: ts.Statement; compiler: typeof ts }) => {
	if (compiler.isVariableStatement(statement)) {
		return statement.declarationList.declarations
			.map((declaration) => declaration.name)
			.filter(compiler.isIdentifier)
			.map((name) => name.text);
	}

	if (
		compiler.isFunctionDeclaration(statement) ||
		compiler.isClassDeclaration(statement) ||
		compiler.isInterfaceDeclaration(statement) ||
		compiler.isTypeAliasDeclaration(statement) ||
		compiler.isEnumDeclaration(statement) ||
		compiler.isModuleDeclaration(statement)
	) {
		return statement.name === undefined || !compiler.isIdentifier(statement.name) ? [] : [statement.name.text];
	}

	return [];
};

const isExported = ({ statement, compiler }: { statement: ts.Statement; compiler: typeof ts }) => {
	if (compiler.isExportDeclaration(statement) || compiler.isExportAssignment(statement)) {
		return true;
	}

	return (
		compiler.canHaveModifiers(statement) && (compiler.getModifiers(statement) ?? []).some((modifier) => modifier.kind === compiler.SyntaxKind.ExportKeyword)
	);
};

/** A name matched as a whole word, so `padding2` never counts as a reference to `padding`. */
const isReferencedIn = ({ text, name }: { text: string; name: string }) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);

/**
 * Keeps imports, exports with their leading docblocks, and then every top-level
 * declaration named in what is kept so far, until the set stops growing — so a
 * `Params` interface and a private helper arrive with the export that needs them.
 *
 * Pure: the same bytes must give the same answer, or hash-keyed reuse means
 * nothing.
 */
export const extractSourceEvidence = ({ path, content, compiler }: Params): { text: string; definitions: string[] } => {
	const scriptKind = /\.tsx$/.test(path) ? compiler.ScriptKind.TSX : compiler.ScriptKind.TS;
	const source = compiler.createSourceFile(path, content, compiler.ScriptTarget.Latest, false, scriptKind);
	const statements = [...source.statements];

	if (statements.length === 0) {
		return { text: content, definitions: [] };
	}

	const entries = statements.map((statement) => ({
		statement,
		text: content.slice(statement.pos, statement.end).trim(),
		names: declaredNames({ statement, compiler }),
		kept: compiler.isImportDeclaration(statement) || compiler.isImportEqualsDeclaration(statement) || isExported({ statement, compiler }),
	}));

	let growing = true;

	while (growing) {
		const keptText = entries
			.filter((entry) => entry.kept)
			.map((entry) => entry.text)
			.join('\n\n');

		growing = false;

		for (const entry of entries) {
			if (entry.kept || !entry.names.some((name) => isReferencedIn({ text: keptText, name }))) {
				continue;
			}

			entry.kept = true;
			growing = true;
		}
	}

	const kept = entries.filter((entry) => entry.kept);

	return { text: kept.map((entry) => entry.text).join('\n\n'), definitions: kept.flatMap((entry) => entry.names) };
};
