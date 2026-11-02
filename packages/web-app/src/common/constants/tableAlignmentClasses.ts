import { TableAlignment } from '#src/common/constants/TableAlignment.ts';

// Spelled out rather than interpolated, because Tailwind only emits classes it
// can read in the source.
export const tableAlignmentClasses: Record<TableAlignment, string> = {
	[TableAlignment.Left]: 'text-left',
	[TableAlignment.Center]: 'text-center',
	[TableAlignment.Right]: 'text-right',
};
