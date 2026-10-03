import type { RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';

/**
 * `as const` asserts nothing about a value's type — it freezes a literal — and
 * the named-constants document asks for it by name.
 */
const isAsConst = ({ node, compiler }: { node: ts.AsExpression; compiler: typeof ts }) =>
	compiler.isTypeReferenceNode(node.type) && compiler.isIdentifier(node.type.typeName) && node.type.typeName.text === 'const';

/**
 * Only source files reach a check declaring this input, so the document's
 * test-file allowance for `as unknown as T` needs nothing here to hold.
 */
const getAssertionLines = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => {
	const lines: number[] = [];

	const visit = (node: ts.Node) => {
		if (compiler.isAsExpression(node) && !isAsConst({ node, compiler })) {
			lines.push(sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1);
		}

		node.forEachChild(visit);
	};

	visit(sourceFile);

	return lines;
};

/** The value a function hands back when its whole body is one `return`, or an arrow's expression. */
const getOnlyReturned = ({ body, compiler }: { body: ts.ConciseBody; compiler: typeof ts }): ts.Expression | undefined => {
	let returned: ts.Expression | undefined;

	if (!compiler.isBlock(body)) {
		returned = body;
	} else if (body.statements.length === 1) {
		const [only] = body.statements;

		returned = only !== undefined && compiler.isReturnStatement(only) ? only.expression : undefined;
	}

	return returned;
};

/**
 * A type guard whose body is `true` proves nothing: the compiler takes the
 * predicate on trust, exactly as it takes a cast.
 */
const getUntestedGuardLines = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => {
	const lines: number[] = [];
	const visit = (node: ts.Node) => {
		if (
			(compiler.isArrowFunction(node) || compiler.isFunctionDeclaration(node) || compiler.isFunctionExpression(node)) &&
			node.type !== undefined &&
			compiler.isTypePredicateNode(node.type) &&
			node.body !== undefined &&
			getOnlyReturned({ body: node.body, compiler })?.kind === compiler.SyntaxKind.TrueKeyword
		) {
			lines.push(sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1);
		}

		node.forEachChild(visit);
	};

	visit(sourceFile);

	return lines;
};

const describeLines = ({ what, lines }: { what: string; lines: number[] }) => `${what} at ${lines.length > 1 ? 'lines' : 'line'} ${lines.join(', ')}`;

/** One finding per file, naming the casts and the untested guards apart, since each is fixed differently. */
const buildFileFindings = ({ input }: { input: SyntaxTreeInput }) => {
	const findings: RawStandardsFinding[] = [];

	for (const [path, sourceFile] of input.trees) {
		const casts = getAssertionLines({ sourceFile, compiler: input.compiler });
		const guards = getUntestedGuardLines({ sourceFile, compiler: input.compiler });
		const details = [
			...(casts.length > 0 ? [describeLines({ what: '`as` cast', lines: casts })] : []),
			...(guards.length > 0 ? [describeLines({ what: 'a type guard that tests nothing', lines: guards })] : []),
		];

		if (details.length > 0) {
			findings.push(
				buildRawFinding({
					rule: 'type-assertion',
					files: [{ path }],
					detail: details.join('; '),
					guidance: 'Narrow with `typeof`, `instanceof` or a discriminated union, or write a type guard that tests the value.',
				}),
			);
		}
	}

	return findings;
};

// Scanning for the word would hit `as` in an import alias, a string and a
// comment alike; only the tree says which occurrence is the assertion.
export const check: StandardsCheckModule = {
	inputKinds: ['syntax-tree'],
	run: ({ inputs }): RawStandardsFinding[] => {
		const input = inputs['syntax-tree'];

		return input === undefined ? [] : buildFileFindings({ input });
	},
};
