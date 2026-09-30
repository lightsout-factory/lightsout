import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildTreeLineCheck } from '#common/checks/buildTreeLineCheck.ts';

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

// Scanning for the word would hit `as` in an import alias, a string and a
// comment alike; only the tree says which occurrence is the assertion.
export const check: StandardsCheckModule = buildTreeLineCheck({
	rule: 'type-assertion',
	findLines: getAssertionLines,
	detail: ({ lines }) => `\`as\` cast at ${lines.length > 1 ? 'lines' : 'line'} ${lines.join(', ')}`,
	guidance: 'Narrow with `typeof`, `instanceof` or a discriminated union — an assertion that is genuinely unavoidable needs a comment saying why.',
});
