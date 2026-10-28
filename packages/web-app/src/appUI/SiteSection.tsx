import type { ReactNode } from 'react';

interface Props {
	title: string;
	children: ReactNode;
}

/** One titled part of a public-site page, ruled off from the part above it. */
export const SiteSection = ({ title, children }: Props) => (
	<section className="flex flex-col gap-5 border-border border-t pt-8">
		<h2 className="font-bold text-drop-navy text-xl">{title}</h2>
		{children}
	</section>
);
