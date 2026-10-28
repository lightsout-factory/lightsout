import type ts from 'typescript';

interface Params {
	statement: ts.Statement;
	/** The consumer's TypeScript, exactly as the syntax-tree input hands it over. */
	compiler: typeof ts;
}

/** Whether a top-level statement carries the `export` keyword — the file's public contract is what the rules about exports judge. */
export const isExportedStatement = ({ statement, compiler }: Params): boolean =>
	(compiler.canHaveModifiers(statement) ? (compiler.getModifiers(statement) ?? []) : []).some(
		(modifier) => modifier.kind === compiler.SyntaxKind.ExportKeyword,
	);
