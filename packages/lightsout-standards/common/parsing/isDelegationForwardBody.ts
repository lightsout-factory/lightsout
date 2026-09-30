import type ts from 'typescript';

interface Params {
	/** A function-like body — a block, or an arrow's concise expression body. */
	body: ts.Node;
	/** The consumer's TypeScript, exactly as the input hands it over. */
	compiler: typeof ts;
}

/**
 * A one-call forward to a `this`-held collaborator is the exact shape the
 * composition-over-inheritance rule mandates in place of `extends`, so two
 * classes holding the same collaborator share these bodies BY DESIGN, and a
 * duplicate detector that reports them is reporting the standards' own remedy.
 *
 * Anything past a single forward — a second statement, a computation, a call
 * on anything but a `this`-held field — is not the mandated shape and stays a
 * duplicate candidate.
 *
 * @mirrors packages/engine/src/standardsCheck/internal/common/utils/isDelegationForwardBody.ts
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
