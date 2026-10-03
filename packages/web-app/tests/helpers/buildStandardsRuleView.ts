import type { StandardsRuleView } from '@lightsout/engine';
import { StandardsSet, StandardsSeverity } from '@lightsout/engine/contracts';

interface Params {
	rule?: string;
	deterministic?: boolean;
	agent?: boolean;
	severity?: StandardsRuleView['severity'];
	fromConfig?: boolean;
	options?: Record<string, number>;
	findingCount?: number;
	prose?: string;
	history?: Partial<StandardsRuleView['history']>;
}

/** One rule's row, joined as `getStandardsView` joins it, over a rule nothing remarkable has happened to. */
export const buildStandardsRuleView = ({
	rule = 'file-size',
	deterministic = true,
	agent = !deterministic,
	severity = StandardsSeverity.Blocking,
	fromConfig = false,
	options = { file: 250 },
	findingCount = 0,
	prose = 'Files stay under ~250 lines.',
	history = {},
}: Params = {}): StandardsRuleView => ({
	rule,
	doc: '@lightsout/lightsout-standards: code/fractal/size',
	documentPath: 'code/fractal/size',
	set: StandardsSet.Code,
	summary: 'a file over the standards line cap',
	prose,
	deterministic,
	agent,
	severity,
	fromConfig,
	options,
	findingCount,
	history: { attempted: 0, resolved: 0, declined: 0, untracked: 0, adviceApplied: 0, adviceDeclined: 0, adviceAlreadyMet: 0, reasons: [], ...history },
});
