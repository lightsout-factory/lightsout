import type { ReactNode } from 'react';

interface Props {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	children?: ReactNode;
}

/** The value is a node, not a number, so a caller can pass a dash: "no check has run" and "zero findings" are different facts. */
export const HealthTile = ({ label, value, hint, children }: Props) => (
	<div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3">
		<span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
		<span className="font-semibold text-2xl">{value}</span>
		{hint === undefined ? null : <span className="text-muted-foreground text-xs">{hint}</span>}
		{children}
	</div>
);
