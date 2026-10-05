import type ts from 'typescript';

interface Params {
	node: ts.Node;
	/** The consumer's TypeScript, exactly as the syntax-tree input hands it over. */
	compiler: typeof ts;
	/** Keeps each literal's own text in the stream, so two bodies match only when their values match too. */
	keepLiterals?: boolean;
}

/** A string, a number, a boolean, or one fixed piece of a template string. */
const isLiteral = ({ node, compiler }: { node: ts.Node; compiler: typeof ts }) =>
	compiler.isStringLiteralLike(node) ||
	compiler.isNumericLiteral(node) ||
	compiler.isTemplateHead(node) ||
	compiler.isTemplateMiddleOrTemplateTail(node) ||
	node.kind === compiler.SyntaxKind.TrueKeyword ||
	node.kind === compiler.SyntaxKind.FalseKeyword;

/**
 * Hook names stay significant: the Rules of Hooks forbid parameterizing or
 * conditionally calling a hook, so thin wrappers that each bind a different
 * hook cannot be merged.
 */
export const normalizeFunctionTokens = ({ node, compiler, keepLiterals = false }: Params): string[] => {
	let tokens: string[];

	if (compiler.isIdentifier(node) || compiler.isPrivateIdentifier(node)) {
		tokens = /^use[A-Z]/.test(node.text) ? [node.text] : ['ID'];
	} else if (isLiteral({ node, compiler })) {
		// Two functions differing only in the literals they use are still the same function, unless the caller keeps them apart.
		tokens = [keepLiterals ? `LIT:${node.getText()}` : 'LIT'];
	} else {
		const children = node.getChildren();

		tokens = children.length === 0 ? [String(node.kind)] : children.flatMap((child) => normalizeFunctionTokens({ node: child, compiler, keepLiterals }));
	}

	return tokens;
};
