import type ts from 'typescript';

interface Params {
	/** A function-like body — a block, or an arrow's concise expression body. */
	body: ts.Node;
	/** The consumer's TypeScript, exactly as the input hands it over. */
	compiler: typeof ts;
}

/**
 * The shape the composition-over-inheritance rule mandates in place of
 * `extends` — `update({ patch }) { return this.runState.update({ patch }); }` —
 * so two classes holding the same collaborator share these bodies by design.
 * Both duplication tiers consult this one predicate so they never disagree.
 *
 * @mirrors packages/lightsout-standards/common/parsing/isDelegationForwardBody.ts
 */
export const isDelegationForwardBody = ({ body, compiler }: Params): boolean => {
	const statements = compiler.isBlock(body) ? body.statements : undefined;
	const [only] = statements ?? [];
	const returned =
		statements === undefined ? body : statements.length === 1 && only !== undefined && compiler.isReturnStatement(only) ? only.expression : undefined;

	return (
		returned !== undefined &&
		compiler.isCallExpression(returned) &&
		compiler.isPropertyAccessExpression(returned.expression) &&
		compiler.isPropertyAccessExpression(returned.expression.expression) &&
		returned.expression.expression.expression.kind === compiler.SyntaxKind.ThisKeyword
	);
};
