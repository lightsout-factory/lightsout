import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import { buildUnconsumedExportCheck } from '#common/checks/buildUnconsumedExportCheck.ts';

// A folder barrel's mention does not count, since nothing imports through one.
// Any other mention does, even in a comment or a string, so calling a live
// export dead is rare.
export const check: StandardsCheckModule = buildUnconsumedExportCheck({
	rule: 'dead-export',
	detail: 'referenced nowhere else',
	guidance: 'A dead code candidate. Delete it — version control has the history.',
});
