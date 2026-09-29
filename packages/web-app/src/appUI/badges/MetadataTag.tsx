import type { ReactNode } from 'react';
import { cn } from '#src/common/utils/cn.ts';

interface Props {
	children: ReactNode;
	className?: string;
	title?: string;
}

/**
 * Mono is reserved for values a reader would type or paste somewhere else, so
 * the face itself signals an identifier rather than prose.
 */
export const MetadataTag = ({ children, className, title }: Props) => (
	<span
		title={title}
		className={cn(
			'inline-flex items-center rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground-strong',
			className,
		)}
	>
		{children}
	</span>
);
