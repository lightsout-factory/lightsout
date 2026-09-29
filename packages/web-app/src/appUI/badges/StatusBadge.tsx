import { Badge } from '#src/appUI/badges/Badge.tsx';
import type { BadgeVariant } from '#src/common/constants/BadgeVariant.ts';

interface Props<TStatus extends string> {
	status: TStatus;
	config: Record<TStatus, { label: string; variant: BadgeVariant }>;
	live?: boolean;
}

export const StatusBadge = <TStatus extends string>({ status, config, live = false }: Props<TStatus>) => (
	<Badge variant={config[status].variant}>
		{live ? <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-current" /> : null}
		{config[status].label}
	</Badge>
);
