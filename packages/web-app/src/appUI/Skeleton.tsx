import type { ComponentProps } from 'react';
import { cn } from '#src/common/utils/cn.ts';

export const Skeleton = ({ className, ...rest }: ComponentProps<'div'>) => (
	<div data-slot="skeleton" className={cn('animate-pulse rounded-md bg-muted', className)} {...rest} />
);
