import { Menu } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '#src/common/controls/Button.tsx';
import { Dialog } from '#src/common/controls/Dialog.tsx';

interface Props {
	/** The site's pages, as the wide-screen row renders them, so the menu cannot drift into offering different ones. */
	children: ReactNode;
}

/** The narrow-screen way to the site's pages: a menu button that opens them in a dialog. */
export const SitePagesMenu = ({ children }: Props) => {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<Button type="button" variant="ghost" size="icon" aria-label="Open menu" className="md:hidden" onClick={() => setIsOpen(true)}>
				<Menu className="size-4" />
			</Button>
			<Dialog open={isOpen} onOpenChange={setIsOpen} title="Menu">
				<nav aria-label="Site pages" className="flex flex-col gap-3">
					{children}
				</nav>
			</Dialog>
		</>
	);
};
