import type ts from 'typescript';

interface Params {
	/** Repo-relative path — the extension picks the parse flavour (.tsx/.jsx need JSX). */
	path: string;
	content: string;
	/** The consumer's TypeScript module (resolveConsumerTypescript) — parses its JS/TS dialects. */
	compiler: typeof ts;
}

const bindingNames = ({ name, compiler }: { name: ts.BindingName; compiler: typeof ts }): string[] =>
	compiler.isIdentifier(name)
		? [name.text]
		: name.elements.flatMap((element) => (compiler.isOmittedExpression(element) ? [] : bindingNames({ name: element.name, compiler })));

const isExported = ({ statement, compiler }: { statement: ts.Statement; compiler: typeof ts }) =>
	compiler.canHaveModifiers(statement) && (compiler.getModifiers(statement) ?? []).some((modifier) => modifier.kind === compiler.SyntaxKind.ExportKeyword);

/**
 * The names a file declares and exports itself, read from its syntax rather
 * than guessed from its file name. A re-export (`export … from`) declares
 * nothing: the name belongs to the file it comes from, so a file that only
 * re-exports contributes no name at all. An unnamed default export has no name
 * to search by.
 */
export const readDeclaredExports = ({ path, content, compiler }: Params): string[] => {
	const scriptKind = /\.[jt]sx$/.test(path) ? compiler.ScriptKind.TSX : compiler.ScriptKind.TS;
	const source = compiler.createSourceFile(path, content, compiler.ScriptTarget.Latest, false, scriptKind);
	const names: string[] = [];

	for (const statement of source.statements) {
		if (compiler.isExportDeclaration(statement)) {
			const clause = statement.exportClause;

			if (statement.moduleSpecifier === undefined && clause !== undefined && compiler.isNamedExports(clause)) {
				names.push(...clause.elements.map((element) => element.name.text));
			}
		} else if (isExported({ statement, compiler })) {
			if (compiler.isVariableStatement(statement)) {
				names.push(...statement.declarationList.declarations.flatMap((declaration) => bindingNames({ name: declaration.name, compiler })));
			} else if (
				(compiler.isFunctionDeclaration(statement) ||
					compiler.isClassDeclaration(statement) ||
					compiler.isInterfaceDeclaration(statement) ||
					compiler.isTypeAliasDeclaration(statement) ||
					compiler.isEnumDeclaration(statement)) &&
				statement.name !== undefined
			) {
				names.push(statement.name.text);
			}
		}
	}

	return [...new Set(names)];
};
