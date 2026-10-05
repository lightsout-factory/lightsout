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
 * The shape the composition-over-inheritance rule mandates in place of
 * `extends` — `update({ patch }) { return this.runState.update({ patch }); }` —
 * so two classes holding the same collaborator share these bodies by design.
 * A call that returns nothing and a read of one of the collaborator's fields
 * count too. Both duplication tiers consult this one predicate so they never disagree.
 *
 * @mirrors packages/lightsout-standards/common/parsing/isDelegationForwardBody.ts
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
