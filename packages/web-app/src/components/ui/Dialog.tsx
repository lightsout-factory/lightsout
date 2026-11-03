import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
	open: boolean;
	/** Radix reports every close — the scrim, the close button, and Escape — through this one callback. */
	onOpenChange: (open: boolean) => void;
	title: ReactNode;
	action?: ReactNode;
	children: ReactNode;
}

/**
 * Named for what it is to Radix rather than how it looks: the drawer is styling
 * over a dialog, and the accessible name, focus trap and Escape handler come
 * from the primitive.
 */
export const Dialog = ({ open, onOpenChange, title, action, children }: Props) => (
	<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in" />
			{/* No description element: the drawer's body is the content, and Radix warns unless the absence is stated. */}
			<DialogPrimitive.Content
				aria-describedby={undefined}
				className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-border border-l bg-card shadow-lg data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
			>
				<header className="flex items-center justify-between gap-3 border-border border-b px-5 py-3">
					<DialogPrimitive.Title className="min-w-0 truncate font-mono text-sm">{title}</DialogPrimitive.Title>
					<div className="flex shrink-0 items-center gap-1">
						{action}
						<DialogPrimitive.Close aria-label="Close" className="rounded-md p-1.5 transition-colors hover:bg-accent">
							<X className="size-4" />
						</DialogPrimitive.Close>
					</div>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	</DialogPrimitive.Root>
);
