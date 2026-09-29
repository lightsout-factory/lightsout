import type { RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildRawFinding } from '../../../../../common/findings/buildRawFinding.ts';

const isArithmeticOperator = ({ kind, compiler }: { kind: ts.SyntaxKind; compiler: typeof ts }): boolean =>
	kind === compiler.SyntaxKind.AsteriskToken ||
	kind === compiler.SyntaxKind.PlusToken ||
	kind === compiler.SyntaxKind.MinusToken ||
	kind === compiler.SyntaxKind.SlashToken ||
	kind === compiler.SyntaxKind.PercentToken;

/**
 * A numeric expression with no moving parts: literals combined by arithmetic
 * (`10 * 60_000`) NAME a number rather than compute one, so hoisting one of
 * these is the same debt as hoisting the literal it folds to.
 */
const isFoldedNumber = ({ node, compiler }: { node: ts.Expression; compiler: typeof ts }): boolean =>
	compiler.isNumericLiteral(node) ||
	(compiler.isPrefixUnaryExpression(node) && isFoldedNumber({ node: node.operand, compiler })) ||
	(compiler.isParenthesizedExpression(node) && isFoldedNumber({ node: node.expression, compiler })) ||
	(compiler.isBinaryExpression(node) &&
		isArithmeticOperator({ kind: node.operatorToken.kind, compiler }) &&
		isFoldedNumber({ node: node.left, compiler }) &&
		isFoldedNumber({ node: node.right, compiler }));

/**
 * A lookup map, a structured config object and anything computed are the
 * rule's carve-outs, excluded by not being one of these.
 */
const isScalarLiteral = ({ node, compiler }: { node: ts.Expression; compiler: typeof ts }): boolean =>
	compiler.isStringLiteral(node) ||
	compiler.isNoSubstitutionTemplateLiteral(node) ||
	node.kind === compiler.SyntaxKind.TrueKeyword ||
	node.kind === compiler.SyntaxKind.FalseKeyword ||
	isFoldedNumber({ node, compiler });

/**
 * Exported constants are left out: their readers are in other files, so this
 * file cannot count them. `let` is left out because it is state, not a
 * constant.
 */
const getStatementScalars = ({ statement, compiler }: { statement: ts.Statement; compiler: typeof ts }) => {
	const names: string[] = [];

	if (compiler.isVariableStatement(statement)) {
		const isConstant = (statement.declarationList.flags & compiler.NodeFlags.Const) !== 0;
		const isExported = statement.modifiers?.some((modifier) => modifier.kind === compiler.SyntaxKind.ExportKeyword) === true;

		if (isConstant && !isExported) {
			for (const declaration of statement.declarationList.declarations) {
				if (compiler.isIdentifier(declaration.name) && declaration.initializer !== undefined && isScalarLiteral({ node: declaration.initializer, compiler })) {
					names.push(declaration.name.text);
				}
			}
		}
	}

	return names;
};

const getModuleScalars = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) =>
	sourceFile.statements.flatMap((statement) => getStatementScalars({ statement, compiler }));

/** How often each name appears in the file, the declaration's own mention included — so a single-use constant appears exactly twice. */
const countMentions = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => {
	const counts = new Map<string, number>();

	const visit = (node: ts.Node) => {
		if (compiler.isIdentifier(node)) {
			counts.set(node.text, (counts.get(node.text) ?? 0) + 1);
		}

		node.forEachChild(visit);
	};

	visit(sourceFile);

	return counts;
};

/** One finding per file — the fix is to move the value into the function below it, which is one edit however many constants sit above. */
const buildFileFindings = ({ input }: { input: SyntaxTreeInput }) => {
	const findings: RawStandardsFinding[] = [];

	for (const [path, tree] of input.trees) {
		const counts = countMentions({ sourceFile: tree, compiler: input.compiler });
		const hoisted = getModuleScalars({ sourceFile: tree, compiler: input.compiler }).filter((name) => counts.get(name) === 2);

		if (hoisted.length > 0) {
			findings.push(
				buildRawFinding({
					rule: 'single-use-scalar',
					files: [{ path }],
					detail: `${hoisted.map((name) => `'${name}'`).join(', ')} ${hoisted.length > 1 ? 'are' : 'is'} declared at module scope and read once`,
					guidance: 'Declare it inside the function that reads it — module scope is for values read in 2+ places, lookup maps and structured config.',
				}),
			);
		}
	}

	return findings;
};

export const check: StandardsCheckModule = {
	inputKind: 'syntax-tree',
	// Both halves of the question need the tree: whether the initializer is a bare
	// scalar rather than a map, and how many places actually read the name.
	run: ({ input }): RawStandardsFinding[] => (input.kind === 'syntax-tree' ? buildFileFindings({ input }) : []),
};
