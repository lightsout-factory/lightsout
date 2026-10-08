import type { ImportGraphInput } from '@lightsout/standards-contracts';
import { StandardsInputKind } from '@lightsout/standards-contracts';

interface Params extends Partial<Omit<ImportGraphInput, 'kind' | 'dependencies'>> {
	edges?: Array<{ from: string; to: string }>;
	dependencies?: Array<[string, string[]]>;
}

/** Both ends of every edge become known files. */
export const setupImportGraphInput = ({ edges = [], dependencies = [], ...overrides }: Params = {}): ImportGraphInput => {
	const paths = [...new Set(edges.flatMap(({ from, to }) => [from, to]))];

	return {
		kind: StandardsInputKind.ImportGraph,
		cwd: '/repo',
		source: paths,
		tests: [],
		files: paths,
		referenceFiles: [],
		// Every test the input names is a test of the repo too, unless the caller says otherwise.
		referenceTests: overrides.tests ?? [],
		standardsLibraries: [],
		edges,
		dependencies: new Map(dependencies),
		...overrides,
	};
};
