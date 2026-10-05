import type ts from 'typescript';

interface Params {
	/** A function-like body — a block, or an arrow's concise expression body. */
	body: ts.Node;
	/** The consumer's TypeScript, exactly as the input hands it over. */
	compiler: typeof ts;
}

/** The one expression a body exists for: a concise arrow's own, or a lone statement's, returned or not. */
const soleExpressionOf = ({ body, compiler }: Params): ts.Node | undefined => {
	const statements = compiler.isBlock(body) ? body.statements : undefined;
	const [only] = statements ?? [];
	const isLoneForward = statements?.length === 1 && only !== undefined && (compiler.isReturnStatement(only) || compiler.isExpressionStatement(only));
	const lone = isLoneForward ? only.expression : undefined;

	return statements === undefined ? body : lone;
};

/**
 * A body that only passes on to a `this`-held collaborator is the exact shape
 * the composition-over-inheritance rule mandates in place of `extends`, so two
 * classes holding the same collaborator share these bodies BY DESIGN, and a
 * duplicate detector that reports them is reporting the standards' own remedy.
 * Three forms count: a returned call, a call that returns nothing, and a read
 * of one of the collaborator's fields.
 *
 * Anything past a single forward — a second statement, a computation, a call
 * on anything but a `this`-held field — is not the mandated shape and stays a
 * duplicate candidate.
 *
 * @mirrors packages/engine/src/standardsCheck/common/buildCheckInput/buildCloneSpansInput/blankDelegationSpans/isDelegationForwardBody.ts
 */
export const isDelegationForwardBody = ({ body, compiler }: Params): boolean => {
	const sole = soleExpressionOf({ body, compiler });
	// A call is judged by what it calls, so `this.runState.update(…)` and the
	// plain read `this.runState.cwd` are the same shape.
	const reached = sole !== undefined && compiler.isCallExpression(sole) ? sole.expression : sole;

	return (
		reached !== undefined &&
		compiler.isPropertyAccessExpression(reached) &&
		compiler.isPropertyAccessExpression(reached.expression) &&
		reached.expression.expression.kind === compiler.SyntaxKind.ThisKeyword
	);
};
