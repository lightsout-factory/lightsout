import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildTreeLineCheck } from '#common/checks/buildTreeLineCheck.ts';
import { getExportName } from '#common/naming/getExportName.ts';

/** The one kind of file that writes a key: the factory that declares the query. */
const isQueryOptionsFile = ({ path }: { path: string }) => getExportName({ path }).endsWith('QueryOptions');

/** `queryKey: issuesQueryOptions().queryKey` reads the one key off its options object; anything else written under that name is a key spelled by hand. */
const readsKeyOffOptions = ({ node, compiler }: { node: ts.PropertyAssignment; compiler: typeof ts }) =>
	compiler.isPropertyAccessExpression(node.initializer) && node.initializer.name.text === 'queryKey';

const isHandWrittenQueryKey = ({ node, compiler }: { node: ts.Node; compiler: typeof ts }) => {
	if (compiler.isShorthandPropertyAssignment(node)) {
		return node.name.text === 'queryKey';
	}

	return compiler.isPropertyAssignment(node) && compiler.isIdentifier(node.name) && node.name.text === 'queryKey' && !readsKeyOffOptions({ node, compiler });
};

const findQueryKeyLines = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => {
	const found: number[] = [];

	if (isQueryOptionsFile({ path: sourceFile.fileName })) {
		return found;
	}

	const visit = (node: ts.Node) => {
		if (isHandWrittenQueryKey({ node, compiler })) {
			found.push(sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1);
		}

		node.forEachChild(visit);
	};

	visit(sourceFile);

	return found;
};

// Parsed rather than scanned for the word: `queryKey` read off an options
// object, as an invalidation does, is a use of the one key, and only the tree
// tells that from a key written by hand.
export const check: StandardsCheckModule = buildTreeLineCheck({
	rule: 'query-options-per-query',
	findLines: findQueryKeyLines,
	detail: ({ lines }) => `a queryKey is written at ${lines.length > 1 ? 'lines' : 'line'} ${lines.join(', ')}`,
	guidance: 'Declare the query once in a file named with a QueryOptions suffix, give it its key there, and read that object here.',
});
