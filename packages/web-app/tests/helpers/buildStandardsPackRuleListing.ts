import type { StandardsPackRuleListing } from '@lightsout/engine';
import { StandardsSet, StandardsSeverity } from '@lightsout/engine/contracts';

interface Params {
	id?: string;
	/** Left out, the id under the lightsout library. */
	name?: string;
	set?: StandardsSet;
	documentPath?: string;
	summary?: string;
	deterministic?: boolean;
	agent?: boolean;
	defaultSeverity?: typeof StandardsSeverity.Blocking | typeof StandardsSeverity.Advisory;
	defaultOptions?: Record<string, number>;
	fixtureCounts?: { pass: number; fail: number };
}

/** One rule's row, as a library's view lists it — an ordinary rule with a deterministic check and both sides of its proof. */
export const buildStandardsPackRuleListing = ({
	id = 'type-assertion',
	name = `lightsout/${id}`,
	set = StandardsSet.Code,
	documentPath = 'code/agent-corrections/type-safety',
	summary = 'When an `as` cast is fine, and when to narrow the type instead.',
	deterministic = true,
	agent = !deterministic,
	defaultSeverity = StandardsSeverity.Blocking,
	defaultOptions = {},
	fixtureCounts = { pass: 1, fail: 1 },
}: Params = {}): StandardsPackRuleListing => ({
	id,
	name,
	set,
	documentPath,
	summary,
	deterministic,
	agent,
	defaultSeverity,
	defaultOptions,
	fixtureCounts,
});
