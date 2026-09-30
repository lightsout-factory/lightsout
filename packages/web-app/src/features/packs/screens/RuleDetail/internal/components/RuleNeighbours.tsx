import type { StandardsPackRuleListing } from '@lightsout/engine';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '#src/common/utils/cn.ts';

const NeighbourLink = ({ library, rule, isNext }: { library: string; rule: StandardsPackRuleListing; isNext: boolean }) => (
	<Link
		to="/standards-packs/$library/rules/$rule"
		params={{ library, rule: rule.id }}
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
	/** The library both neighbours belong to — the first segment of their page addresses. */
	library: string;
	previous?: StandardsPackRuleListing;
	next?: StandardsPackRuleListing;
}

export const RuleNeighbours = ({ library, previous, next }: Props) =>
	previous === undefined && next === undefined ? null : (
		<nav aria-label="Neighbouring rules" className="flex flex-col gap-3 sm:flex-row">
			{previous === undefined ? <span className="hidden flex-1 sm:block" /> : <NeighbourLink library={library} rule={previous} isNext={false} />}
			{next === undefined ? <span className="hidden flex-1 sm:block" /> : <NeighbourLink library={library} rule={next} isNext />}
		</nav>
	);
