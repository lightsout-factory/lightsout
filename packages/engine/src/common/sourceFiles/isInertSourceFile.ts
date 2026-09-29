import type ts from 'typescript';

interface Params {
	/** Repo-relative path — the extension picks the parse flavor (.tsx/.jsx need JSX). */
	path: string;
	content: string;
	/** The consumer's TypeScript module (resolveConsumerTypescript) — parses its JS/TS dialects. */
	compiler: typeof ts;
}

/**
 * Barrels and type-only files are the set the test standards exempt, and a
 * test writer given one only burns the spawn or writes implementation-coupled
 * noise. Conservative on purpose: anything else, even an enum or a constant
 * with a fallback expression, counts as logic and keeps its writer.
 */
export const isInertSourceFile = ({ path, content, compiler }: Params): boolean => {
	const scriptKind = /\.[jt]sx$/.test(path) ? compiler.ScriptKind.TSX : compiler.ScriptKind.TS;
	const source = compiler.createSourceFile(path, content, compiler.ScriptTarget.Latest, false, scriptKind);

	return source.statements.every(
		(statement) =>
			compiler.isImportDeclaration(statement) ||
			compiler.isExportDeclaration(statement) ||
			compiler.isTypeAliasDeclaration(statement) ||
			compiler.isInterfaceDeclaration(statement),
	);
};
