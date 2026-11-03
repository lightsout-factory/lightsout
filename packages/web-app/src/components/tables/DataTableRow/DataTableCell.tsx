import type { ReactNode } from 'react';
import { TableAlignment } from '#src/constants/TableAlignment.ts';
import { tableAlignmentClasses } from '#src/constants/tableAlignmentClasses.ts';
import { cn } from '#src/utils/cn.ts';

interface Props {
	align?: TableAlignment;
	className?: string;
	children: ReactNode;
}

export const DataTableCell = ({ align = TableAlignment.Left, className, children }: Props) => (
	<td className={cn('px-3 py-2 align-middle', tableAlignmentClasses[align], className)}>{children}</td>
);
