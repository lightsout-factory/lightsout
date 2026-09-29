import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
	icon?: LucideIcon;
	title: string;
	description?: ReactNode;
	action?: ReactNode;
}

export const EmptyState = ({ icon: Icon, title, description, action }: Props) => (
	<div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
		{Icon === undefined ? null : <Icon aria-hidden="true" className="size-6 text-muted-foreground" />}
		<p className="font-medium text-sm">{title}</p>
		{description === undefined ? null : <div className="text-muted-foreground text-sm">{description}</div>}
		{action}
	</div>
);
