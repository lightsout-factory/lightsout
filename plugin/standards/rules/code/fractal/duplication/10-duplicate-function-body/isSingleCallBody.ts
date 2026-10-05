import type ts from 'typescript';

interface Params {
	/** A function-like body: a block, or an arrow's concise expression body. */
	body: ts.Node;
	/** The consumer's TypeScript, exactly as the input hands it over. */
	compiler: typeof ts;
}

/** A body that does nothing but call one other function, awaited or not: `=> listSection({ ... })`, or a block holding that one return. */
export const isSingleCallBody = ({ body, compiler }: Params): boolean => {
	const statements = compiler.isBlock(body) ? body.statements : undefined;
	const [only] = statements ?? [];
	const returned =
		statements === undefined ? body : statements.length === 1 && only !== undefined && compiler.isReturnStatement(only) ? only.expression : undefined;
	const called = returned !== undefined && compiler.isAwaitExpression(returned) ? returned.expression : returned;

	return called !== undefined && compiler.isCallExpression(called);
};
