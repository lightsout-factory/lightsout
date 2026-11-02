export const TableAlignment = {
	Left: 'left',
	Center: 'center',
	Right: 'right',
} as const;

export type TableAlignment = (typeof TableAlignment)[keyof typeof TableAlignment];
