import type ts from 'typescript';

interface Params {
	/** Repo-relative path — the extension picks the parse flavor (.tsx/.jsx need JSX). */
	path: string;
	content: string;
	/** The consumer's TypeScript module (resolveConsumerTypescript) — parses its JS/TS dialects. */
	compiler: typeof ts;
}

/** Function and class bodies open their own scope, so an `await` inside one is ordinary async code. */
const hasModuleScopeAwait = ({ node, compiler }: { node: ts.Node; compiler: typeof ts }): boolean => {
	if (compiler.isFunctionLike(node) || compiler.isClassLike(node)) {
		return false;
	}

	// `for await (… of …)` carries its await on the statement, not as an expression.
	if (compiler.isAwaitExpression(node) || (compiler.isForOfStatement(node) && node.awaitModifier !== undefined)) {
		return true;
	}

	return node.forEachChild((child) => hasModuleScopeAwait({ node: child, compiler })) === true;
};

/**
 * A module-scope `await` is legal only where the file is evaluated as an ES
 * module, and a syntax error under CommonJS. Which one the consumer's runner
 * uses is `selectUnloadableFiles`'s question; this reads syntax alone.
 */
export const isUnloadableSourceFile = ({ path, content, compiler }: Params): boolean => {
	const scriptKind = /\.[jt]sx$/.test(path) ? compiler.ScriptKind.TSX : compiler.ScriptKind.TS;
	const source = compiler.createSourceFile(path, content, compiler.ScriptTarget.Latest, false, scriptKind);

	return source.statements.some((statement) => hasModuleScopeAwait({ node: statement, compiler }));
};
