import type { StandardsCheckInput, TestFileInput } from '@lightsout/standards-contracts';
import { StandardsInputKind } from '@lightsout/standards-contracts';

interface Params extends Partial<Omit<TestFileInput, 'kind' | 'contents'>> {
	contents?: Array<[string, string]>;
}

export const setupTestFileInput = ({ contents = [], ...overrides }: Params = {}): StandardsCheckInput => ({
	kind: StandardsInputKind.TestFile,
	cwd: '/repo',
	tests: contents.map(([path]) => path),
	contents: new Map(contents),
	...overrides,
});
