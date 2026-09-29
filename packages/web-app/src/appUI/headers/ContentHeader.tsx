import { Link, type LinkProps } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

interface Crumb {
	label: string;
	/** Omitted on the last crumb, which is the page already open. */
	link?: LinkProps;
}

interface Props {
	crumbs: Crumb[];
}

export const ContentHeader = ({ crumbs }: Props) => (
	<nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-muted-foreground text-xs">
		{crumbs.map((crumb, index) => (
			<Fragment key={crumb.label}>
				{index === 0 ? null : <ChevronRight aria-hidden="true" className="size-3" />}
				{crumb.link === undefined ? (
					<span aria-current="page" className="text-foreground">
						{crumb.label}
					</span>
				) : (
					<Link {...crumb.link} className="transition-colors hover:text-foreground">
						{crumb.label}
					</Link>
				)}
			</Fragment>
		))}
	</nav>
);
