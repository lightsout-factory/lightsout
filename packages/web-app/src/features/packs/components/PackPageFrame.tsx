import type { ComponentProps, ReactNode } from 'react';
import { ContentHeader } from '#src/appUI/headers/ContentHeader.tsx';

interface Props {
	/** The trail to this page, drawn just under the site's top bar; left out on the packs page, which is the top of the trail. */
	crumbs?: ComponentProps<typeof ContentHeader>['crumbs'];
	children: ReactNode;
}

/**
 * The frame every Standards Packs page sits in — the packs, one set's rules, one
 * rule — so moving between them never changes the page's width or margins.
 *
 * The trail sits close under the top bar, apart from the page it leads to, the
 * way a site's navigation does; the page's own content starts below it.
 */
export const PackPageFrame = ({ crumbs, children }: Props) => (
	<div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-6 pb-16">
		{crumbs === undefined ? null : <ContentHeader crumbs={crumbs} />}
		<div className={crumbs === undefined ? 'flex flex-col gap-12 pt-10' : 'flex flex-col gap-12'}>{children}</div>
	</div>
);
