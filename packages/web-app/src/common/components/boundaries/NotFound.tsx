import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Button } from '#src/appUI/buttons/Button.tsx';

interface Props {
	children?: ReactNode;
}

export const NotFound = ({ children }: Props) => (
	<div className="flex flex-col items-start gap-3 p-8">
		<p className="text-muted-foreground text-sm">{children ?? 'That page does not exist.'}</p>
		<Button asChild size="sm">
			<Link to="/">Back to runs</Link>
		</Button>
	</div>
);
