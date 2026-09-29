import type { ComponentProps, ReactNode } from 'react';
import { ContentHeader } from '#src/appUI/headers/ContentHeader.tsx';

interface Props {
	/** Left out on the packs page, which is the top of the trail. */
	crumbs?: ComponentProps<typeof ContentHeader>['crumbs'];
	children: ReactNode;
}

/** Shared by every Standards Packs page, so moving between them never changes the page's width or margins. */
export const PackPageFrame = ({ crumbs, children }: Props) => (
	<div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-6 pb-16">
		{crumbs === undefined ? null : <ContentHeader crumbs={crumbs} />}
		<div className={crumbs === undefined ? 'flex flex-col gap-12 pt-10' : 'flex flex-col gap-12'}>{children}</div>
	</div>
);
