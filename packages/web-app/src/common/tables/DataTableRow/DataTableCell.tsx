import type { ReactNode } from 'react';
import { cn } from '#src/common/cn.ts';
import { TableAlignment, tableAlignmentClasses } from '#src/common/constants/TableAlignment.ts';

interface Props {
	align?: TableAlignment;
	className?: string;
	children: ReactNode;
}

export const DataTableCell = ({ align = TableAlignment.Left, className, children }: Props) => (
	<td className={cn('px-3 py-2 align-middle', tableAlignmentClasses[align], className)}>{children}</td>
);
