import type { ReactNode } from 'react';
import { cn } from '#src/common/utils/cn.ts';

interface Props {
	/** Omitted, the card is a plain bordered box. */
	title?: ReactNode;
	action?: ReactNode;
	className?: string;
	children: ReactNode;
}

export const Card = ({ title, action, className, children }: Props) => (
	<section data-slot="card" className={cn('rounded-lg border border-border bg-card text-card-foreground', className)}>
		{title === undefined ? null : (
			<header className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
				<h2 className="font-semibold text-sm">{title}</h2>
				{action}
			</header>
		)}
		<div className="p-4">{children}</div>
	</section>
);
