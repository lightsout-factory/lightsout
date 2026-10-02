import type { CloneSpansInput } from '@lightsout/standards-contracts';
import { StandardsInputKind } from '@lightsout/standards-contracts';

type Params = Partial<Omit<CloneSpansInput, 'kind'>>;

export const setupCloneSpansInput = ({ spans = [], ...overrides }: Params = {}): CloneSpansInput => ({
	kind: StandardsInputKind.CloneSpans,
	cwd: '/repo',
	source: ['src/a/alpha.ts', 'src/b/beta.ts'],
	spans,
	...overrides,
});
