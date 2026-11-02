import type { ReactNode } from 'react';

interface Props {
	children: ReactNode;
}

export const FailureNotice = ({ children }: Props) => (
	<p className="rounded-md border border-status-failed-border bg-status-failed-light px-3 py-2 text-sm text-status-failed">{children}</p>
);
