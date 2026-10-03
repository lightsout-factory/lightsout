import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildTreeLineCheck } from '#common/checks/buildTreeLineCheck.ts';

/** The block a function's statements sit in. An arrow with an expression body has none, and returns exactly once. */
const getBlockBody = ({ node, compiler }: { node: ts.Node; compiler: typeof ts }): ts.Block | undefined => {
	let body: ts.Block | undefined;

	if (
		(compiler.isFunctionDeclaration(node) ||
			compiler.isFunctionExpression(node) ||
			compiler.isArrowFunction(node) ||
			compiler.isMethodDeclaration(node) ||
			compiler.isGetAccessorDeclaration(node) ||
			compiler.isSetAccessorDeclaration(node) ||
			compiler.isConstructorDeclaration(node)) &&
		node.body !== undefined &&
		compiler.isBlock(node.body)
	) {
		body = node.body;
	}

	return body;
};

/** The returns that belong to the function owning `node`: a nested function's returns are its own. */
const collectReturns = ({ node, compiler }: { node: ts.Node; compiler: typeof ts }): ts.ReturnStatement[] => {
	const found: ts.ReturnStatement[] = [];
	const visit = (child: ts.Node) => {
		if (compiler.isReturnStatement(child)) {
			found.push(child);
		}

		if (!compiler.isFunctionLike(child)) {
			child.forEachChild(visit);
		}
	};

	node.forEachChild(visit);

	return found;
};

/** What a guard clause hands back: nothing, or a fixed value that says "no result", never a computed one. */
const isSentinel = ({ expression, compiler }: { expression: ts.Expression | undefined; compiler: typeof ts }): boolean =>
	expression === undefined ||
	compiler.isLiteralExpression(expression) ||
	expression.kind === compiler.SyntaxKind.NullKeyword ||
	expression.kind === compiler.SyntaxKind.TrueKeyword ||
	expression.kind === compiler.SyntaxKind.FalseKeyword ||
	(compiler.isIdentifier(expression) && expression.text === 'undefined') ||
	(compiler.isArrayLiteralExpression(expression) && expression.elements.length === 0) ||
	(compiler.isObjectLiteralExpression(expression) && expression.properties.length === 0);

/**
 * A guard clause is an `if` with no `else`, before any other statement, whose
 * returns hand back nothing or a sentinel. An `if` that returns a computed
 * value is a branch of the result, however early it sits.
 */
const isGuard = ({ statement, compiler }: { statement: ts.Statement; compiler: typeof ts }): boolean =>
	compiler.isIfStatement(statement) &&
	statement.elseStatement === undefined &&
	collectReturns({ node: statement, compiler }).every((returned) => isSentinel({ expression: returned.expression, compiler }));

const findEarlyReturns = ({ body, compiler }: { body: ts.Block; compiler: typeof ts }): ts.ReturnStatement[] => {
	const statements = [...body.statements];
	const firstOther = statements.findIndex((statement) => !isGuard({ statement, compiler }));
	const guards = firstOther === -1 ? statements : statements.slice(0, firstOther);
	const allowed = new Set<ts.Node>(guards.flatMap((guard) => collectReturns({ node: guard, compiler })));
	const last = statements.at(-1);

	if (last !== undefined) {
		allowed.add(last);
	}

	return collectReturns({ node: body, compiler }).filter((returned) => !allowed.has(returned));
};

const getEarlyReturnLines = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => {
	const lines: number[] = [];
	const visit = (node: ts.Node) => {
		const body = getBlockBody({ node, compiler });

		if (body !== undefined) {
			for (const returned of findEarlyReturns({ body, compiler })) {
				lines.push(sourceFile.getLineAndCharacterOfPosition(returned.getStart(sourceFile)).line + 1);
			}
		}

		node.forEachChild(visit);
	};

	visit(sourceFile);

	return lines.sort((first, second) => first - second);
};

// Only the tree says which function a `return` belongs to, and whether it is
// that function's last statement or sits inside a guard at its top.
export const check: StandardsCheckModule = buildTreeLineCheck({
	rule: 'single-return',
	findLines: getEarlyReturnLines,
	detail: ({ lines }) => `a \`return\` before the end of its function at ${lines.length > 1 ? 'lines' : 'line'} ${lines.join(', ')}`,
	guidance: 'Return once, at the end: assign the result in each branch and return it after them. Only a guard clause at the top returns early.',
});
