import type { StandardsPackRuleListing } from '@lightsout/engine';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '#src/common/utils/cn.ts';
import { toRuleSetSlug } from '#src/features/packs/internal/common/utils/toRuleSetSlug.ts';

/** One end's link: which way it points, and the rule it opens. */
const NeighbourLink = ({ rule, isNext }: { rule: StandardsPackRuleListing; isNext: boolean }) => (
	<Link
		to="/standards-packs/$ruleSet/$rule"
		params={{ ruleSet: toRuleSetSlug({ channel: rule.channel }), rule: rule.id }}
		className={cn(
			'group flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border p-4 transition-colors hover:border-primary-tint-border hover:bg-muted/40',
			isNext && 'items-end text-right',
		)}
	>
		<span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
			{isNext ? null : <ArrowLeft aria-hidden="true" className="size-3.5" />}
			{isNext ? 'Next rule' : 'Previous rule'}
			{isNext ? <ArrowRight aria-hidden="true" className="size-3.5" /> : null}
		</span>
		<span className="max-w-full truncate font-mono font-semibold text-drop-navy text-sm group-hover:text-primary">{rule.id}</span>
	</Link>
);

interface Props {
	previous?: StandardsPackRuleListing;
	next?: StandardsPackRuleListing;
}

/** The rules either side of this one in its set, so a reader can walk the set rule by rule. */
export const RuleNeighbours = ({ previous, next }: Props) =>
	previous === undefined && next === undefined ? null : (
		<nav aria-label="Neighbouring rules" className="flex flex-col gap-3 sm:flex-row">
			{previous === undefined ? <span className="hidden flex-1 sm:block" /> : <NeighbourLink rule={previous} isNext={false} />}
			{next === undefined ? <span className="hidden flex-1 sm:block" /> : <NeighbourLink rule={next} isNext />}
		</nav>
	);
