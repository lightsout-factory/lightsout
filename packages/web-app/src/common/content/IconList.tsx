import type { LucideIcon } from 'lucide-react';
import { cn } from '#src/common/cn.ts';

interface Props {
	items: string[];
	/** Leads every item: the marker the list's meaning is read from. */
	Icon: LucideIcon;
	className?: string;
	itemClassName?: string;
	iconClassName?: string;
}

/** A list whose every item is led by one icon, so what the items have in common is said once. */
export const IconList = ({ items, Icon, className, itemClassName, iconClassName }: Props) => (
	<ul className={className}>
		{items.map((item) => (
			<li key={item} className={cn('flex gap-2', itemClassName)}>
				<Icon aria-hidden="true" className={cn('shrink-0', iconClassName)} />
				{item}
			</li>
		))}
	</ul>
);
