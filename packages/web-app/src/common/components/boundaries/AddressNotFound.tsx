import type { ReactNode } from 'react';

interface Props {
	title: string;
	children: ReactNode;
}

/**
 * Distinct from `NotFound`, which answers a path the router does not recognise:
 * this answers a well-formed path whose subject is absent.
 */
export const AddressNotFound = ({ title, children }: Props) => (
	<div className="flex h-full flex-col items-start justify-center gap-2 p-10">
		<h1 className="font-semibold text-lg">{title}</h1>
		<p className="text-muted-foreground text-sm">{children}</p>
	</div>
);
