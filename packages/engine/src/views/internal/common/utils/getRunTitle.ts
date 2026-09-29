import { basename, dirname } from 'node:path';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { FrozenWorklist } from '#src/views/internal/common/types/FrozenWorklist.ts';

const namedRuleLimit = 3;

const describeRules = ({ rules }: { rules: string[] }) => {
	const distinct = [...new Set(rules)];
	const named = distinct.slice(0, namedRuleLimit).join(', ');
	const rest = distinct.length - namedRuleLimit;

	return rest > 0 ? `${named} +${rest} more` : named;
};

interface Params {
	/** Repo-relative plan path from the manifest. */
	plan: string;
	/** The run's frozen work-list, already parsed and tagged, when one was readable. */
	worklist?: FrozenWorklist;
}

/**
 * A frozen work-list names the run better than its path: two refactor runs
 * differ by the rules they burn down, and their paths are identical.
 */
export const getRunTitle = ({ plan, worklist }: Params): string => {
	const name = basename(plan);
	const stem = name.replace(/\.md$/, '');
	const folder = basename(dirname(plan));
	const rules = worklist?.kind === PipelineKind.Refactor ? (worklist.worklist?.batches.map((batch) => batch.rule) ?? []) : [];
	let title: string;

	if (worklist?.kind === PipelineKind.Coverage) {
		// No count: the frozen measurement carries no threshold and no per-file
		// pass/fail, so there is nothing honest to count in a title.
		title = PipelineKind.Coverage;
	} else if (worklist?.kind === PipelineKind.Refactor || name.endsWith('worklist.json')) {
		title = rules.length > 0 ? `${PipelineKind.Refactor} · ${describeRules({ rules })}` : PipelineKind.Refactor;
	} else if (stem === 'plan' || stem === 'overview') {
		title = folder;
	} else {
		title = /^phase\d+/.test(stem) ? `${folder} · ${stem}` : stem;
	}

	return title;
};
