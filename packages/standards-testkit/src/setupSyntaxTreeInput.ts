import type { StandardsCheckInput, SyntaxTreeInput } from '@lightsout/standards-contracts';
import { StandardsInputKind } from '@lightsout/standards-contracts';
import ts from 'typescript';

interface Params extends Partial<Omit<SyntaxTreeInput, 'kind' | 'trees' | 'compiler' | 'dependencies'>> {
	sources?: Array<[string, string]>;
	dependencies?: Array<[string, string[]]>;
}

/**
 * Uses this package's own compiler, not `resolveConsumerTypescript`, which finds
 * the checked repo's compiler and returns nothing when it has none.
 *
 * Parsed with parent pointers set: checks walk upward from a node, and a tree
 * without them fails in ways that look like the rule is wrong.
 */
export const setupSyntaxTreeInput = ({ sources = [], dependencies = [], ...overrides }: Params = {}): StandardsCheckInput => {
	const paths = sources.map(([path]) => path);
	const trees = new Map(sources.map(([path, text]) => [path, ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)]));

	return {
		kind: StandardsInputKind.SyntaxTree,
		cwd: '/repo',
		source: paths,
		tests: [],
		files: paths,
		referenceFiles: [],
		standardsPacks: [],
		compiler: ts,
		trees,
		dependencies: new Map(dependencies),
		...overrides,
	};
};
