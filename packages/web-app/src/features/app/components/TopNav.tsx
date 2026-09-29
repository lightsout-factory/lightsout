import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Button } from '#src/appUI/buttons/Button.tsx';
import { ThemeToggle } from '#src/appUI/buttons/ThemeToggle.tsx';
import { Dialog } from '#src/appUI/Dialog.tsx';
import { Wordmark } from '#src/features/app/components/Wordmark.tsx';

/**
 * Rendered in both the wide-screen row and the narrow-screen menu, so the two
 * cannot drift into offering different pages. Docs has no index of its own, so
 * it points at the configuration doc.
 */
const SitePages = () => (
	<>
		<Link to="/standards-packs" className="text-sm">
			Standards packs
		</Link>
		<Link to="/commands" className="text-sm">
			Commands
		</Link>
		<Link to="/docs/$doc" params={{ doc: 'configuration' }} className="text-sm">
			Docs
		</Link>
	</>
);

export const TopNav = () => {
	const [menuOpen, setMenuOpen] = useState(false);

	return (
		<header className="flex shrink-0 items-center gap-4 border-border border-b bg-background px-4 py-3">
			<Wordmark />
			<nav aria-label="Site" className="hidden items-center gap-4 md:flex">
				<SitePages />
			</nav>
			<div className="ml-auto flex items-center gap-1">
				<ThemeToggle />
				<Button asChild variant="ghost" size="sm">
					<a href="https://github.com/lightsout-factory/lightsout" target="_blank" rel="noreferrer">
						GitHub
					</a>
				</Button>
				<Button type="button" variant="ghost" size="icon" aria-label="Open menu" className="md:hidden" onClick={() => setMenuOpen(true)}>
					<Menu className="size-4" />
				</Button>
			</div>
			<Dialog open={menuOpen} onOpenChange={setMenuOpen} title="Menu">
				<nav aria-label="Site pages" className="flex flex-col gap-3">
					<SitePages />
				</nav>
			</Dialog>
		</header>
	);
};
