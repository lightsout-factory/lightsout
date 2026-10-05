import type ts from 'typescript';
import { isDelegationForwardBody } from '#src/standardsCheck/common/buildCheckInput/buildCloneSpansInput/blankDelegationSpans/isDelegationForwardBody.ts';

interface Params {
	/** Repo-relative path, only to name the parsed file. */
	path: string;
	/** The file's text, imports already blanked. */
	text: string;
	/** The consumer's TypeScript. */
	compiler: typeof ts;
}

const isAssigningConstructor = ({ node, compiler }: { node: ts.ConstructorDeclaration; compiler: typeof ts }) =>
	node.body?.statements.every(
		(statement) =>
			compiler.isExpressionStatement(statement) &&
			compiler.isBinaryExpression(statement.expression) &&
			statement.expression.operatorToken.kind === compiler.SyntaxKind.EqualsToken &&
			compiler.isPropertyAccessExpression(statement.expression.left) &&
			statement.expression.left.expression.kind === compiler.SyntaxKind.ThisKeyword,
	);

/**
 * The standards mandate composition in place of `extends`, so a class that
 * forwards to a shared collaborator through one-line methods and getters repeats
 * that shape by design; counting it as duplication reports the remedy as the disease.
 *
 * Uses `isDelegationForwardBody`, the predicate the duplicate-function-body
 * rule consults, so the two duplication tiers never disagree about the exempt
 * shape. Blanking is newline-preserving, so reported line numbers stay true.
 */
export const blankDelegationSpans = ({ path, text, compiler }: Params): string => {
	const sourceFile = compiler.createSourceFile(path, text, compiler.ScriptTarget.Latest, true);
	const lines = text.split('\n');
	const blank = ({ node }: { node: ts.Node }) => {
		const start = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
		const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;

		for (let line = start; line <= end; line += 1) {
			lines[line] = '';
		}
	};

	const visit = (node: ts.Node) => {
		if (compiler.isClassDeclaration(node) || compiler.isClassExpression(node)) {
			for (const member of node.members) {
				if (compiler.isConstructorDeclaration(member) && isAssigningConstructor({ node: member, compiler })) {
					blank({ node: member });
				}

				const forwards = compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member);

				if (forwards && member.body !== undefined && isDelegationForwardBody({ body: member.body, compiler })) {
					blank({ node: member });
				}
			}
		}

		node.forEachChild(visit);
	};

	visit(sourceFile);

	return lines.join('\n');
};
