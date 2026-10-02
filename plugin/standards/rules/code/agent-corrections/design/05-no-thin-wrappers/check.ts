import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildTreeLineCheck } from '#common/checks/buildTreeLineCheck.ts';

const isExported = ({ node, compiler }: { node: ts.Node; compiler: typeof ts }) =>
	compiler.canHaveModifiers(node) && (compiler.getModifiers(node) ?? []).some((modifier) => modifier.kind === compiler.SyntaxKind.ExportKeyword);

/**
 * Type ARGUMENTS separate a rename from a derivation: `z.infer<typeof Schema>`
 * and `ReturnType<typeof make>` compute a type rather than rename one.
 */
const isBareRename = ({ node, compiler }: { node: ts.TypeAliasDeclaration; compiler: typeof ts }) =>
	compiler.isTypeReferenceNode(node.type) && node.type.typeArguments === undefined && node.typeParameters === undefined;

/**
 * Only when the alias is the file's only export: an alias beside the code that
 * uses it is a local convenience, while an alias alone in a file is a hop a
 * reader makes to learn nothing.
 */
const getIndirectionLines = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => {
	const exported = sourceFile.statements.filter((statement) => isExported({ node: statement, compiler }));
	const [only] = exported;

	return exported.length === 1 && only !== undefined && compiler.isTypeAliasDeclaration(only) && isBareRename({ node: only, compiler })
		? [sourceFile.getLineAndCharacterOfPosition(only.getStart()).line + 1]
		: [];
};

// The tree, not the text: `export type A = B` and `export type A = B<C>` differ
// by two characters and only one of them is a rename. Only the renaming file is
// a fact of the tree; whether a function adds anything is the agent's to judge,
// which is why the rule is checked in part.
export const check: StandardsCheckModule = buildTreeLineCheck({
	rule: 'no-thin-wrappers',
	findLines: getIndirectionLines,
	detail: ({ lines }) => `the file's only export is a type alias renaming another type, at line ${lines.join(', ')}`,
	guidance:
		'Use the original type directly and delete the file — where the semantic distinction matters, a comment at the usage site says it more cheaply than a hop.',
});
