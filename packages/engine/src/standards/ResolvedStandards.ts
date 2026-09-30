import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';

export interface ResolvedStandards {
	standards?: string;
	testStandards?: string;
	groups: StandardsGroup[];
}
