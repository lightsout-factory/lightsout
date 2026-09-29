import type { DefinitionEntry } from '#src/common/types/DefinitionEntry.ts';
import { cn } from '#src/common/utils/cn.ts';

interface Props {
	entries: DefinitionEntry[];
	className?: string;
}

/**
 * Each pair is wrapped in a `display: contents` element so it carries one key
 * without breaking the two-column grid the `dl` lays out.
 */
export const DefinitionList = ({ entries, className }: Props) => (
	<dl className={cn('grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-border bg-muted px-3 py-2 text-xs', className)}>
		{entries.map(([term, value]) => (
			<div key={term} className="contents">
				<dt className="font-medium">{term}</dt>
				<dd>{value}</dd>
			</div>
		))}
	</dl>
);
