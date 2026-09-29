import type { ReactNode } from 'react';
import { cn } from '#src/common/utils/cn.ts';

interface Props {
	children: ReactNode;
	className?: string;
}

/**
 * Pure CSS via `@starting-style` (Tailwind's `starting:`): no script decides
 * when to show it, so nothing can leave it stuck invisible, and a browser
 * without `@starting-style` shows it without the fade.
 */
export const Appear = ({ children, className }: Props) => (
	<div className={cn('translate-y-0 opacity-100 transition-all duration-500 ease-out starting:translate-y-2 starting:opacity-0', className)}>{children}</div>
);
