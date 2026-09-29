import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Button } from '#src/appUI/buttons/Button.tsx';
import { ThemeToggle } from '#src/appUI/buttons/ThemeToggle.tsx';
import { Dialog } from '#src/appUI/Dialog.tsx';
import { GithubMark } from '#src/appUI/icons/GithubMark.tsx';
import { Wordmark } from '#src/features/app/components/Wordmark.tsx';

const siteLinkClasses = 'font-medium text-muted-foreground-strong transition-colors hover:text-foreground';

/**
 * Rendered in both the wide-screen row and the narrow-screen menu, so the two
 * cannot drift into offering different pages. Docs has no index of its own, so
 * it points at the configuration doc.
 */
const SitePages = () => (
	<>
		<Link to="/standards-packs" className={siteLinkClasses}>
			Standards Packs
		</Link>
		<Link to="/commands" className={siteLinkClasses}>
			Commands
		</Link>
		<Link to="/docs/$doc" params={{ doc: 'configuration' }} className={siteLinkClasses}>
			Docs
		</Link>
	</>
);

export const SiteHeader = () => {
	const [menuOpen, setMenuOpen] = useState(false);

	return (
		<header className="sticky top-0 z-30 flex items-center gap-10 border-border border-b bg-background/80 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8">
			<Wordmark />
			<nav aria-label="Site" className="hidden items-center gap-8 md:flex">
				<SitePages />
			</nav>
			<div className="ml-auto flex items-center gap-1">
				<ThemeToggle />
				<Button asChild variant="ghost" size="icon" className="text-foreground hover:text-foreground/70">
					<a href="https://github.com/lightsout-factory/lightsout" target="_blank" rel="noreferrer" aria-label="GitHub">
						<GithubMark className="size-4.5" />
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
