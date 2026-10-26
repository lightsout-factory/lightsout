import type ts from 'typescript';
import { isDelegationForwardBody } from '#common/parsing/isDelegationForwardBody.ts';

interface Params {
	sourceFile: ts.SourceFile;
	/** The consumer's TypeScript, exactly as the input hands it over. */
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
	) === true;

/**
 * The 1-based lines of every class member that only holds or forwards to a
 * collaborator: a constructor that only assigns `this` fields, and a method or
 * getter whose body is a single forward. Composition in place of `extends`
 * repeats these by design, so a copy made of them alone is no duplicate.
 */
export const findForwardingLines = ({ sourceFile, compiler }: Params): Set<number> => {
	const lines = new Set<number>();

	const mark = ({ node }: { node: ts.Node }) => {
		const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
		const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;

		for (let line = start; line <= end; line += 1) {
			lines.add(line + 1);
		}
	};

	const visit = (node: ts.Node) => {
		if (compiler.isClassDeclaration(node) || compiler.isClassExpression(node)) {
			for (const member of node.members) {
				const forwards = compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member);

				if (compiler.isConstructorDeclaration(member) && isAssigningConstructor({ node: member, compiler })) {
					mark({ node: member });
				}

				if (forwards && member.body !== undefined && isDelegationForwardBody({ body: member.body, compiler })) {
					mark({ node: member });
				}
			}
		}

		node.forEachChild(visit);
	};

	visit(sourceFile);

	return lines;
};
