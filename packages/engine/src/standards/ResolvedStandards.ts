import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';

export interface ResolvedStandards {
	standards?: string;
	testStandards?: string;
	groups: StandardsGroup[];
}
